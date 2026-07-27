import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, stringToHex } from "viem";

describe("PucukReceiptRegistry", async function () {
  const { viem } = await network.create();
  const wallets = await viem.getWalletClients();
  const [owner, operator, farmer, factory, auditor, stranger] = wallets;
  const receiptId = keccak256(stringToHex("PP-2026-000042"));
  const commercialHash = keccak256(stringToHex("commercial-v1"));
  const evidenceHash = keccak256(stringToHex("evidence-v1"));

  let registry: Awaited<ReturnType<typeof viem.deployContract>>;

  beforeEach(async function () {
    registry = await viem.deployContract("PucukReceiptRegistry", [owner.account.address]);
    await registry.write.setRole([operator.account.address, 1], { account: owner.account });
    await registry.write.setRole([factory.account.address, 2], { account: owner.account });
    await registry.write.setRole([auditor.account.address, 3], { account: owner.account });
  });

  async function createAndSubmit() {
    await registry.write.createDraft(
      [receiptId, farmer.account.address, factory.account.address, commercialHash, evidenceHash, 95_625n],
      { account: operator.account },
    );
    await registry.write.submitForFarmer([receiptId], { account: operator.account });
  }

  it("runs the canonical happy path through a full recorded IDR payment", async function () {
    await createAndSubmit();
    await registry.write.farmerAgree([receiptId], { account: farmer.account });
    await registry.write.approveLiability([receiptId], { account: factory.account });
    await registry.write.recordPayment(
      [receiptId, 40_000n, keccak256(stringToHex("bank-proof-1"))],
      { account: factory.account },
    );

    let receipt = await registry.read.getReceipt([receiptId]);
    assert.equal(receipt.state, 4); // PartiallyPaid
    assert.equal(receipt.paidAmountIdr, 40_000n);

    await registry.write.recordPayment(
      [receiptId, 55_625n, keccak256(stringToHex("bank-proof-2"))],
      { account: factory.account },
    );
    receipt = await registry.read.getReceipt([receiptId]);
    assert.equal(receipt.state, 5); // Paid
    assert.equal(await registry.read.outstandingAmount([receiptId]), 0n);
  });

  it("returns a farmer-rejected receipt to Draft", async function () {
    await createAndSubmit();
    await registry.write.farmerReject(
      [receiptId, keccak256(stringToHex("weight-does-not-match"))],
      { account: farmer.account },
    );
    const receipt = await registry.read.getReceipt([receiptId]);
    assert.equal(receipt.state, 0);
  });

  it("prevents an unauthorized account from approving liability", async function () {
    await createAndSubmit();
    await registry.write.farmerAgree([receiptId], { account: farmer.account });
    await assert.rejects(
      registry.write.approveLiability([receiptId], { account: stranger.account }),
    );
  });

  it("preserves the original and links an auditor-issued replacement", async function () {
    await createAndSubmit();
    await registry.write.farmerAgree([receiptId], { account: farmer.account });
    await registry.write.openDispute(
      [receiptId, keccak256(stringToHex("claimed-weight-41.5"))],
      { account: farmer.account },
    );

    const replacementId = keccak256(stringToHex("PP-2026-000043"));
    await registry.write.issueReplacement(
      [
        receiptId,
        replacementId,
        keccak256(stringToHex("commercial-v2")),
        keccak256(stringToHex("evidence-v2")),
        93_375n,
        keccak256(stringToHex("auditor-decision")),
      ],
      { account: auditor.account },
    );

    const original = await registry.read.getReceipt([receiptId]);
    const replacement = await registry.read.getReceipt([replacementId]);
    assert.equal(original.state, 7); // Superseded
    assert.equal(original.supersededBy, replacementId);
    assert.equal(replacement.state, 2); // Registered
  });

  it("rejects overpayment and direct native-token transfers", async function () {
    await createAndSubmit();
    await registry.write.farmerAgree([receiptId], { account: farmer.account });
    await registry.write.approveLiability([receiptId], { account: factory.account });
    await assert.rejects(
      registry.write.recordPayment(
        [receiptId, 95_626n, keccak256(stringToHex("overpayment"))],
        { account: factory.account },
      ),
    );
    await assert.rejects(
      owner.sendTransaction({ to: registry.address, value: 1n }),
    );
  });
});
