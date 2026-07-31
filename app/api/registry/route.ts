import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  stringToHex,
  type Hash,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  PUCUK_DEFAULT_DEMO_ID,
  PUCUK_EXPLORER,
  PUCUK_REGISTRY_ADDRESS,
  pucukDemoReceiptId,
  pucukRegistryAbi,
  receiptStates,
} from "../../../lib/pucukRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rpcUrl =
  process.env.BASE_SEPOLIA_RPC_URL ?? "https://base-sepolia-rpc.publicnode.com";
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });

const normalizeDemoId = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(value)
    ? value
    : PUCUK_DEFAULT_DEMO_ID;

const receiptLabelFor = (demoId: string) =>
  demoId.startsWith("PP-") ? demoId.replace(/-v\d+$/, "") : `PP-DEMO-${demoId.slice(-8).toUpperCase()}`;

async function transactionHistory(receiptId: Hash) {
  const fromEtherscan = async () => {
    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (!apiKey) return [];
    const query = new URLSearchParams({
      chainid: "84532",
      module: "logs",
      action: "getLogs",
      fromBlock: "44698331",
      toBlock: "latest",
      address: PUCUK_REGISTRY_ADDRESS,
      topic1: receiptId,
      page: "1",
      offset: "100",
      apikey: apiKey,
    });
    const response = await fetch(`https://api.etherscan.io/v2/api?${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      status?: string;
      result?: {
        transactionHash?: Hash;
        blockNumber?: string;
        logIndex?: string;
      }[] | string;
    };
    if (payload.status !== "1" || !Array.isArray(payload.result)) return [];
    const ordered = payload.result.sort((left, right) => {
      const leftBlock = BigInt(left.blockNumber || "0");
      const rightBlock = BigInt(right.blockNumber || "0");
      if (leftBlock !== rightBlock) return leftBlock < rightBlock ? -1 : 1;
      const leftIndex = BigInt(left.logIndex || "0");
      const rightIndex = BigInt(right.logIndex || "0");
      return leftIndex === rightIndex ? 0 : leftIndex < rightIndex ? -1 : 1;
    });
    return [...new Set(ordered.map((log) => log.transactionHash))].filter(
      (hash): hash is Hash => Boolean(hash),
    );
  };

  try {
    const logs = await publicClient.request({
      method: "eth_getLogs",
      params: [{
        address: PUCUK_REGISTRY_ADDRESS,
        fromBlock: `0x${44_698_331n.toString(16)}`,
        toBlock: "latest",
        topics: [null, receiptId],
      }],
    });
    const ordered = logs.sort((left, right) => {
      const leftBlock = left.blockNumber ?? 0n;
      const rightBlock = right.blockNumber ?? 0n;
      if (leftBlock !== rightBlock) {
        return leftBlock < rightBlock ? -1 : 1;
      }
      const leftIndex = left.logIndex ?? 0;
      const rightIndex = right.logIndex ?? 0;
      return leftIndex === rightIndex ? 0 : leftIndex < rightIndex ? -1 : 1;
    });
    const hashes = [...new Set(ordered.map((log) => log.transactionHash))].filter(
      (hash): hash is Hash => Boolean(hash),
    );
    return hashes.length > 0 ? hashes : await fromEtherscan();
  } catch (error) {
    console.warn("RPC receipt history lookup unavailable; trying Etherscan", error);
    try {
      return await fromEtherscan();
    } catch (fallbackError) {
      console.warn("Etherscan receipt history lookup unavailable", fallbackError);
      return [];
    }
  }
}

async function responseFor(
  receipt: Awaited<ReturnType<typeof readReceipt>>,
  transactions: Hash[] = [],
  demoId = PUCUK_DEFAULT_DEMO_ID,
) {
  const receiptId = pucukDemoReceiptId(demoId);
  const history = await transactionHistory(receiptId);
  const combined = [...history, ...transactions];
  const allTransactions = combined.filter(
    (hash, index) => combined.lastIndexOf(hash) === index,
  );
  return NextResponse.json({
    connected: true,
    exists: receipt !== null,
    demoId,
    receiptId,
    receiptLabel: receiptLabelFor(demoId),
    contractAddress: PUCUK_REGISTRY_ADDRESS,
    explorerUrl: `${PUCUK_EXPLORER}/address/${PUCUK_REGISTRY_ADDRESS}`,
    state: receipt ? receiptStates[receipt.state] : "Draft",
    paidAmountIdr: receipt?.paidAmountIdr.toString() ?? "0",
    totalPayableIdr: receipt?.totalPayableIdr.toString() ?? "95625",
    transactions: allTransactions.map((hash) => ({
      hash,
      url: `${PUCUK_EXPLORER}/tx/${hash}`,
    })),
  });
}

async function readReceipt(receiptId: Hash) {
  try {
    return await publicClient.readContract({
      address: PUCUK_REGISTRY_ADDRESS,
      abi: pucukRegistryAbi,
      functionName: "getReceipt",
      args: [receiptId],
    });
  } catch {
    return null;
  }
}

async function waitFor(check: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      if (await check()) return;
    } catch {
      // Public Base RPC replicas can briefly lag after a confirmed transaction.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error("Base Sepolia state did not become readable in time");
}

export async function GET(request: Request) {
  try {
    const demoId = normalizeDemoId(new URL(request.url).searchParams.get("demo"));
    const receiptId = pucukDemoReceiptId(demoId);
    const code = await publicClient.getCode({ address: PUCUK_REGISTRY_ADDRESS });
    if (!code) {
      return NextResponse.json(
        { connected: false, error: "Contract not found on Base Sepolia" },
        { status: 503 },
      );
    }
    return responseFor(await readReceipt(receiptId), [], demoId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registry is unavailable";
    return NextResponse.json({ connected: false, error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const privateKey = process.env.BASE_SEPOLIA_PRIVATE_KEY as
      | `0x${string}`
      | undefined;
    if (!privateKey) {
      return NextResponse.json(
        { error: "Server signer is not configured" },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { action?: string; demoId?: string; receiptId?: string };
    const demoId = normalizeDemoId(body.demoId);
    const receiptId = pucukDemoReceiptId(demoId);
    const receiptLabel = receiptLabelFor(demoId);
    if (body.receiptId !== receiptLabel) {
      return NextResponse.json(
        { error: `Receipt mismatch. Expected ${receiptLabel}; received ${body.receiptId || "none"}. No transaction was submitted.` },
        { status: 409 },
      );
    }
    const allowed = new Set([
      "create",
      "farmerAgree",
      "farmerReject",
      "approve",
      "pay",
      "dispute",
    ]);
    if (!body.action || !allowed.has(body.action)) {
      return NextResponse.json({ error: "Unsupported lifecycle action" }, { status: 400 });
    }

    const account = privateKeyToAccount(privateKey);
    const wallet = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(rpcUrl),
    });
    const owner = await publicClient.readContract({
      address: PUCUK_REGISTRY_ADDRESS,
      abi: pucukRegistryAbi,
      functionName: "owner",
    });
    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error("Configured signer is not the registry owner");
    }

    const hashes: Hash[] = [];
    const send = async (
      functionName:
        | "setRole"
        | "createDraft"
        | "submitForFarmer"
        | "farmerAgree"
        | "farmerReject"
        | "approveLiability"
        | "recordPayment"
        | "openDispute",
      args: readonly unknown[],
    ) => {
      const { request: txRequest } = await publicClient.simulateContract({
        account,
        address: PUCUK_REGISTRY_ADDRESS,
        abi: pucukRegistryAbi,
        functionName,
        args: args as never,
      });
      const hash = await wallet.writeContract(txRequest);
      hashes.push(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`${functionName} reverted`);
      return hash;
    };

    const ensureRole = async (role: 1 | 2) => {
      const current = await publicClient.readContract({
        address: PUCUK_REGISTRY_ADDRESS,
        abi: pucukRegistryAbi,
        functionName: "roles",
        args: [account.address],
      });
      if (current !== role) {
        await send("setRole", [account.address, role]);
        await waitFor(async () => {
          const updated = await publicClient.readContract({
            address: PUCUK_REGISTRY_ADDRESS,
            abi: pucukRegistryAbi,
            functionName: "roles",
            args: [account.address],
          });
          return updated === role;
        });
      }
    };

    let receipt = await readReceipt(receiptId);
    if (body.action === "create") {
      if (!receipt) {
        await ensureRole(1);
        await send("createDraft", [
          receiptId,
          account.address,
          account.address,
          keccak256(stringToHex("PP-2026-000042-commercial-v1")),
          keccak256(stringToHex("PP-2026-000042-evidence-v1")),
          95_625n,
        ]);
        await waitFor(async () => (await readReceipt(receiptId)) !== null);
        receipt = await readReceipt(receiptId);
      }
      if (receipt?.state === 0) {
        await ensureRole(1);
        await send("submitForFarmer", [receiptId]);
        await waitFor(async () => (await readReceipt(receiptId))?.state === 1);
      }
    } else if (!receipt) {
      return NextResponse.json(
        { error: "Operator must create the demo receipt first" },
        { status: 409 },
      );
    } else if (body.action === "farmerAgree" && receipt.state === 1) {
      await send("farmerAgree", [receiptId]);
      await waitFor(async () => (await readReceipt(receiptId))?.state === 2);
    } else if (body.action === "farmerReject" && receipt.state === 1) {
      await send("farmerReject", [
        receiptId,
        keccak256(stringToHex("farmer-correction-request")),
      ]);
      await waitFor(async () => (await readReceipt(receiptId))?.state === 0);
    } else if (body.action === "approve" && receipt.state === 2) {
      await ensureRole(2);
      await send("approveLiability", [receiptId]);
      await waitFor(async () => (await readReceipt(receiptId))?.state === 3);
    } else if (
      body.action === "pay" &&
      (receipt.state === 3 || receipt.state === 4)
    ) {
      await ensureRole(2);
      const outstanding = await publicClient.readContract({
        address: PUCUK_REGISTRY_ADDRESS,
        abi: pucukRegistryAbi,
        functionName: "outstandingAmount",
        args: [receiptId],
      });
      await send("recordPayment", [
        receiptId,
        outstanding,
        keccak256(stringToHex("PP-2026-000042-bank-proof")),
      ]);
      await waitFor(async () => (await readReceipt(receiptId))?.state === 5);
    } else if (
      body.action === "dispute" &&
      (receipt.state === 2 || receipt.state === 3)
    ) {
      await send("openDispute", [
        receiptId,
        keccak256(stringToHex("PP-2026-000042-correction-claim")),
      ]);
      await waitFor(async () => (await readReceipt(receiptId))?.state === 6);
    }

    receipt = await readReceipt(receiptId);
    if (hashes.length === 0) {
      return NextResponse.json(
        {
          error: `Tidak ada transaksi baru. Status receipt saat ini: ${
            receipt ? receiptStates[receipt.state] : "Draft"
          }. Mulai demo baru untuk mengulang alur.`,
        },
        { status: 409 },
      );
    }
    return responseFor(receipt, hashes, demoId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown registry error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
