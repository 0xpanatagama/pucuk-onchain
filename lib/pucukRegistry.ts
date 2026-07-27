import { keccak256, stringToHex } from "viem";

export const PUCUK_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_PUCUK_REGISTRY_ADDRESS ??
    "0x18708aE53414044F7651D7aA4982494bcb2E21b2") as `0x${string}`;

export const PUCUK_EXPLORER = "https://sepolia.basescan.org";
export const PUCUK_DEMO_RECEIPT_ID = keccak256(
  stringToHex("PUCUK-WEB-DEMO-PP-2026-000042-v1"),
);

export const receiptStates = [
  "Draft",
  "AwaitingFarmer",
  "Registered",
  "Approved",
  "PartiallyPaid",
  "Paid",
  "Disputed",
  "Superseded",
] as const;

export const pucukRegistryAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "roles",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "setRole",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "role", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "createDraft",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiptId", type: "bytes32" },
      { name: "farmer", type: "address" },
      { name: "factory", type: "address" },
      { name: "commercialHash", type: "bytes32" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "totalPayableIdr", type: "uint128" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "submitForFarmer",
    stateMutability: "nonpayable",
    inputs: [{ name: "receiptId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "farmerAgree",
    stateMutability: "nonpayable",
    inputs: [{ name: "receiptId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "farmerReject",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiptId", type: "bytes32" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "approveLiability",
    stateMutability: "nonpayable",
    inputs: [{ name: "receiptId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "recordPayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiptId", type: "bytes32" },
      { name: "amountIdr", type: "uint128" },
      { name: "paymentEvidenceHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "openDispute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiptId", type: "bytes32" },
      { name: "claimHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "outstandingAmount",
    stateMutability: "view",
    inputs: [{ name: "receiptId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint128" }],
  },
  {
    type: "function",
    name: "getReceipt",
    stateMutability: "view",
    inputs: [{ name: "receiptId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "commercialHash", type: "bytes32" },
          { name: "evidenceHash", type: "bytes32" },
          { name: "operator", type: "address" },
          { name: "farmer", type: "address" },
          { name: "factory", type: "address" },
          { name: "totalPayableIdr", type: "uint128" },
          { name: "paidAmountIdr", type: "uint128" },
          { name: "createdAt", type: "uint64" },
          { name: "registeredAt", type: "uint64" },
          { name: "state", type: "uint8" },
          { name: "preDisputeState", type: "uint8" },
          { name: "supersededBy", type: "bytes32" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
] as const;
