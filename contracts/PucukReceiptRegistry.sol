// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Pucuk Receipt Registry
/// @notice Records the commercial lifecycle of tea-leaf delivery receipts.
/// @dev This contract stores hashes and settlement evidence, never private documents
///      or funds. IDR payments happen off-chain and are only attested here.
contract PucukReceiptRegistry {
    enum Role {
        None,
        Operator,
        Factory,
        Auditor
    }

    enum ReceiptState {
        Draft,
        AwaitingFarmer,
        Registered,
        Approved,
        PartiallyPaid,
        Paid,
        Disputed,
        Superseded
    }

    struct Receipt {
        bytes32 commercialHash;
        bytes32 evidenceHash;
        address operator;
        address farmer;
        address factory;
        uint128 totalPayableIdr;
        uint128 paidAmountIdr;
        uint64 createdAt;
        uint64 registeredAt;
        ReceiptState state;
        ReceiptState preDisputeState;
        bytes32 supersededBy;
        bool exists;
    }

    address public owner;
    uint256 public receiptCount;

    mapping(address account => Role role) public roles;
    mapping(bytes32 receiptId => Receipt receipt) private receipts;

    error Unauthorized();
    error ZeroAddress();
    error InvalidReceiptId();
    error ReceiptAlreadyExists();
    error ReceiptNotFound();
    error InvalidState(ReceiptState expected, ReceiptState actual);
    error InvalidTransition(ReceiptState actual);
    error InvalidAmount();
    error HashRequired();

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RoleUpdated(address indexed account, Role indexed role);
    event ReceiptCreated(
        bytes32 indexed receiptId,
        address indexed operator,
        address indexed farmer,
        address factory,
        uint128 totalPayableIdr
    );
    event DraftUpdated(bytes32 indexed receiptId, bytes32 commercialHash, bytes32 evidenceHash, uint128 totalPayableIdr);
    event StateChanged(bytes32 indexed receiptId, ReceiptState indexed previousState, ReceiptState indexed newState, address actor);
    event FarmerRejected(bytes32 indexed receiptId, bytes32 indexed reasonHash);
    event PaymentRecorded(
        bytes32 indexed receiptId,
        uint128 amountIdr,
        uint128 cumulativePaidIdr,
        bytes32 indexed paymentEvidenceHash
    );
    event DisputeOpened(bytes32 indexed receiptId, address indexed openedBy, bytes32 indexed claimHash);
    event EvidenceRequested(bytes32 indexed receiptId, bytes32 indexed requestHash);
    event OriginalReinstated(bytes32 indexed receiptId, ReceiptState restoredState, bytes32 indexed reasonHash);
    event ReceiptSuperseded(bytes32 indexed originalReceiptId, bytes32 indexed replacementReceiptId, bytes32 indexed reasonHash);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyRole(Role requiredRole) {
        if (roles[msg.sender] != requiredRole) revert Unauthorized();
        _;
    }

    modifier receiptExists(bytes32 receiptId) {
        if (!receipts[receiptId].exists) revert ReceiptNotFound();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function setRole(address account, Role role) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        roles[account] = role;
        emit RoleUpdated(account, role);
    }

    function createDraft(
        bytes32 receiptId,
        address farmer,
        address factory,
        bytes32 commercialHash,
        bytes32 evidenceHash,
        uint128 totalPayableIdr
    ) external onlyRole(Role.Operator) {
        if (receiptId == bytes32(0)) revert InvalidReceiptId();
        if (farmer == address(0) || factory == address(0)) revert ZeroAddress();
        if (commercialHash == bytes32(0) || evidenceHash == bytes32(0)) revert HashRequired();
        if (totalPayableIdr == 0) revert InvalidAmount();
        if (receipts[receiptId].exists) revert ReceiptAlreadyExists();

        receipts[receiptId] = Receipt({
            commercialHash: commercialHash,
            evidenceHash: evidenceHash,
            operator: msg.sender,
            farmer: farmer,
            factory: factory,
            totalPayableIdr: totalPayableIdr,
            paidAmountIdr: 0,
            createdAt: uint64(block.timestamp),
            registeredAt: 0,
            state: ReceiptState.Draft,
            preDisputeState: ReceiptState.Draft,
            supersededBy: bytes32(0),
            exists: true
        });
        unchecked {
            ++receiptCount;
        }
        emit ReceiptCreated(receiptId, msg.sender, farmer, factory, totalPayableIdr);
    }

    function updateDraft(
        bytes32 receiptId,
        bytes32 commercialHash,
        bytes32 evidenceHash,
        uint128 totalPayableIdr
    ) external receiptExists(receiptId) {
        Receipt storage receipt = receipts[receiptId];
        if (msg.sender != receipt.operator) revert Unauthorized();
        _requireState(receipt, ReceiptState.Draft);
        if (commercialHash == bytes32(0) || evidenceHash == bytes32(0)) revert HashRequired();
        if (totalPayableIdr == 0) revert InvalidAmount();

        receipt.commercialHash = commercialHash;
        receipt.evidenceHash = evidenceHash;
        receipt.totalPayableIdr = totalPayableIdr;
        emit DraftUpdated(receiptId, commercialHash, evidenceHash, totalPayableIdr);
    }

    function submitForFarmer(bytes32 receiptId) external receiptExists(receiptId) {
        Receipt storage receipt = receipts[receiptId];
        if (msg.sender != receipt.operator) revert Unauthorized();
        _transition(receiptId, receipt, ReceiptState.Draft, ReceiptState.AwaitingFarmer);
    }

    function farmerAgree(bytes32 receiptId) external receiptExists(receiptId) {
        Receipt storage receipt = receipts[receiptId];
        if (msg.sender != receipt.farmer) revert Unauthorized();
        _requireState(receipt, ReceiptState.AwaitingFarmer);
        receipt.registeredAt = uint64(block.timestamp);
        _transitionUnchecked(receiptId, receipt, ReceiptState.Registered);
    }

    function farmerReject(bytes32 receiptId, bytes32 reasonHash) external receiptExists(receiptId) {
        Receipt storage receipt = receipts[receiptId];
        if (msg.sender != receipt.farmer) revert Unauthorized();
        _requireState(receipt, ReceiptState.AwaitingFarmer);
        if (reasonHash == bytes32(0)) revert HashRequired();
        emit FarmerRejected(receiptId, reasonHash);
        _transitionUnchecked(receiptId, receipt, ReceiptState.Draft);
    }

    function approveLiability(bytes32 receiptId) external receiptExists(receiptId) {
        Receipt storage receipt = receipts[receiptId];
        if (msg.sender != receipt.factory || roles[msg.sender] != Role.Factory) revert Unauthorized();
        _transition(receiptId, receipt, ReceiptState.Registered, ReceiptState.Approved);
    }

    function recordPayment(bytes32 receiptId, uint128 amountIdr, bytes32 paymentEvidenceHash)
        external
        receiptExists(receiptId)
    {
        Receipt storage receipt = receipts[receiptId];
        if (msg.sender != receipt.factory || roles[msg.sender] != Role.Factory) revert Unauthorized();
        if (receipt.state != ReceiptState.Approved && receipt.state != ReceiptState.PartiallyPaid) {
            revert InvalidTransition(receipt.state);
        }
        if (amountIdr == 0 || paymentEvidenceHash == bytes32(0)) revert InvalidAmount();

        uint128 outstanding = receipt.totalPayableIdr - receipt.paidAmountIdr;
        if (amountIdr > outstanding) revert InvalidAmount();
        receipt.paidAmountIdr += amountIdr;

        ReceiptState nextState =
            receipt.paidAmountIdr == receipt.totalPayableIdr ? ReceiptState.Paid : ReceiptState.PartiallyPaid;
        emit PaymentRecorded(receiptId, amountIdr, receipt.paidAmountIdr, paymentEvidenceHash);
        _transitionUnchecked(receiptId, receipt, nextState);
    }

    function openDispute(bytes32 receiptId, bytes32 claimHash) external receiptExists(receiptId) {
        Receipt storage receipt = receipts[receiptId];
        bool isParticipant = msg.sender == receipt.operator || msg.sender == receipt.farmer || msg.sender == receipt.factory;
        if (!isParticipant && roles[msg.sender] != Role.Auditor) revert Unauthorized();
        if (receipt.state != ReceiptState.Registered && receipt.state != ReceiptState.Approved) {
            revert InvalidTransition(receipt.state);
        }
        if (claimHash == bytes32(0)) revert HashRequired();
        receipt.preDisputeState = receipt.state;
        emit DisputeOpened(receiptId, msg.sender, claimHash);
        _transitionUnchecked(receiptId, receipt, ReceiptState.Disputed);
    }

    function requestAdditionalEvidence(bytes32 receiptId, bytes32 requestHash)
        external
        onlyRole(Role.Auditor)
        receiptExists(receiptId)
    {
        Receipt storage receipt = receipts[receiptId];
        _requireState(receipt, ReceiptState.Disputed);
        if (requestHash == bytes32(0)) revert HashRequired();
        emit EvidenceRequested(receiptId, requestHash);
    }

    function reinstateOriginal(bytes32 receiptId, bytes32 reasonHash)
        external
        onlyRole(Role.Auditor)
        receiptExists(receiptId)
    {
        Receipt storage receipt = receipts[receiptId];
        _requireState(receipt, ReceiptState.Disputed);
        if (reasonHash == bytes32(0)) revert HashRequired();
        ReceiptState restoredState = receipt.preDisputeState;
        emit OriginalReinstated(receiptId, restoredState, reasonHash);
        _transitionUnchecked(receiptId, receipt, restoredState);
    }

    function issueReplacement(
        bytes32 originalReceiptId,
        bytes32 replacementReceiptId,
        bytes32 commercialHash,
        bytes32 evidenceHash,
        uint128 totalPayableIdr,
        bytes32 reasonHash
    ) external onlyRole(Role.Auditor) receiptExists(originalReceiptId) {
        Receipt storage original = receipts[originalReceiptId];
        _requireState(original, ReceiptState.Disputed);
        if (replacementReceiptId == bytes32(0) || replacementReceiptId == originalReceiptId) revert InvalidReceiptId();
        if (receipts[replacementReceiptId].exists) revert ReceiptAlreadyExists();
        if (commercialHash == bytes32(0) || evidenceHash == bytes32(0) || reasonHash == bytes32(0)) {
            revert HashRequired();
        }
        if (totalPayableIdr == 0) revert InvalidAmount();

        receipts[replacementReceiptId] = Receipt({
            commercialHash: commercialHash,
            evidenceHash: evidenceHash,
            operator: original.operator,
            farmer: original.farmer,
            factory: original.factory,
            totalPayableIdr: totalPayableIdr,
            paidAmountIdr: 0,
            createdAt: uint64(block.timestamp),
            registeredAt: uint64(block.timestamp),
            state: ReceiptState.Registered,
            preDisputeState: ReceiptState.Registered,
            supersededBy: bytes32(0),
            exists: true
        });
        unchecked {
            ++receiptCount;
        }
        original.supersededBy = replacementReceiptId;
        emit ReceiptCreated(
            replacementReceiptId, original.operator, original.farmer, original.factory, totalPayableIdr
        );
        emit ReceiptSuperseded(originalReceiptId, replacementReceiptId, reasonHash);
        _transitionUnchecked(originalReceiptId, original, ReceiptState.Superseded);
    }

    function getReceipt(bytes32 receiptId) external view receiptExists(receiptId) returns (Receipt memory) {
        return receipts[receiptId];
    }

    function outstandingAmount(bytes32 receiptId) external view receiptExists(receiptId) returns (uint128) {
        Receipt storage receipt = receipts[receiptId];
        return receipt.totalPayableIdr - receipt.paidAmountIdr;
    }

    receive() external payable {
        revert("Pucuk does not accept funds");
    }

    fallback() external payable {
        revert("Unsupported call");
    }

    function _requireState(Receipt storage receipt, ReceiptState expected) private view {
        if (receipt.state != expected) revert InvalidState(expected, receipt.state);
    }

    function _transition(bytes32 receiptId, Receipt storage receipt, ReceiptState expected, ReceiptState next) private {
        _requireState(receipt, expected);
        _transitionUnchecked(receiptId, receipt, next);
    }

    function _transitionUnchecked(bytes32 receiptId, Receipt storage receipt, ReceiptState next) private {
        ReceiptState previous = receipt.state;
        receipt.state = next;
        emit StateChanged(receiptId, previous, next, msg.sender);
    }
}
