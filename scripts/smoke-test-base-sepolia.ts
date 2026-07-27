import { network } from "hardhat";
import { keccak256, stringToHex, type Hash } from "viem";

const REGISTRY_ADDRESS = "0x18708aE53414044F7651D7aA4982494bcb2E21b2";
const EXPLORER = "https://sepolia.basescan.org";

const { viem } = await network.getOrCreate();
const [wallet] = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();
const registry = await viem.getContractAt("PucukReceiptRegistry", REGISTRY_ADDRESS);

const owner = (await registry.read.owner()) as `0x${string}`;
if (owner.toLowerCase() !== wallet.account.address.toLowerCase()) {
  throw new Error(
    `Configured wallet ${wallet.account.address} is not the contract owner ${owner}`,
  );
}

const bytecode = await publicClient.getCode({ address: REGISTRY_ADDRESS });
if (!bytecode) {
  throw new Error(`No contract found at ${REGISTRY_ADDRESS} on the selected network`);
}

const balance = await publicClient.getBalance({ address: wallet.account.address });
if (balance === 0n) {
  throw new Error(`Wallet ${wallet.account.address} has no Base Sepolia ETH for gas`);
}

const runId = `${Date.now()}-${wallet.account.address}`;
const receiptId = keccak256(stringToHex(`pucuk-smoke-${runId}`));
const commercialHash = keccak256(stringToHex(`commercial-${runId}`));
const evidenceHash = keccak256(stringToHex(`evidence-${runId}`));
const paymentEvidenceHash = keccak256(stringToHex(`payment-${runId}`));
const totalPayableIdr = 1_250_000n;

async function confirm(label: string, hash: Hash) {
  console.log(`${label}: ${EXPLORER}/tx/${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
    retryCount: 20,
    retryDelay: 2_000,
  });
  if (receipt.status !== "success") {
    throw new Error(`${label} reverted: ${hash}`);
  }
  console.log(`  confirmed in block ${receipt.blockNumber}`);
}

async function waitFor(label: string, check: () => Promise<boolean>) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      if (await check()) {
        return;
      }
    } catch {
      // Public RPC replicas can briefly lag behind the block that confirmed the write.
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out waiting for the RPC to expose ${label}`);
}

console.log(`Contract: ${EXPLORER}/address/${REGISTRY_ADDRESS}`);
console.log(`Wallet: ${wallet.account.address}`);
console.log(`Receipt ID: ${receiptId}`);

await confirm(
  "1/7 Assign Operator role",
  await registry.write.setRole([wallet.account.address, 1], {
    account: wallet.account,
  }),
);
await waitFor(
  "Operator role",
  async () => (await registry.read.roles([wallet.account.address])) === 1,
);

await confirm(
  "2/7 Create draft",
  await registry.write.createDraft(
    [
      receiptId,
      wallet.account.address,
      wallet.account.address,
      commercialHash,
      evidenceHash,
      totalPayableIdr,
    ],
    { account: wallet.account },
  ),
);
await waitFor(
  "created Draft receipt",
  async () => (await registry.read.getReceipt([receiptId])).state === 0,
);

await confirm(
  "3/7 Submit for farmer",
  await registry.write.submitForFarmer([receiptId], { account: wallet.account }),
);
await waitFor(
  "AwaitingFarmer state",
  async () => (await registry.read.getReceipt([receiptId])).state === 1,
);

await confirm(
  "4/7 Farmer agrees",
  await registry.write.farmerAgree([receiptId], { account: wallet.account }),
);
await waitFor(
  "Registered state",
  async () => (await registry.read.getReceipt([receiptId])).state === 2,
);

await confirm(
  "5/7 Assign Factory role",
  await registry.write.setRole([wallet.account.address, 2], {
    account: wallet.account,
  }),
);
await waitFor(
  "Factory role",
  async () => (await registry.read.roles([wallet.account.address])) === 2,
);

await confirm(
  "6/7 Approve liability",
  await registry.write.approveLiability([receiptId], { account: wallet.account }),
);
await waitFor(
  "Approved state",
  async () => (await registry.read.getReceipt([receiptId])).state === 3,
);

await confirm(
  "7/7 Record full IDR payment",
  await registry.write.recordPayment(
    [receiptId, totalPayableIdr, paymentEvidenceHash],
    { account: wallet.account },
  ),
);
await waitFor(
  "Paid state",
  async () => (await registry.read.getReceipt([receiptId])).state === 5,
);

const recorded = await registry.read.getReceipt([receiptId]);
if (recorded.state !== 5 || recorded.paidAmountIdr !== totalPayableIdr) {
  throw new Error(
    `Unexpected final state ${recorded.state}; paid ${recorded.paidAmountIdr}`,
  );
}

console.log("");
console.log("Smoke test passed: the receipt reached Paid on Base Sepolia.");
console.log(`Receipt ID: ${receiptId}`);
