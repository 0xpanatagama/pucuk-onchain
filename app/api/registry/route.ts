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
  PUCUK_DEMO_RECEIPT_ID,
  PUCUK_EXPLORER,
  PUCUK_REGISTRY_ADDRESS,
  pucukRegistryAbi,
  receiptStates,
} from "../../../lib/pucukRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rpcUrl =
  process.env.BASE_SEPOLIA_RPC_URL ?? "https://base-sepolia-rpc.publicnode.com";
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });

async function transactionHistory() {
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
      topic1: PUCUK_DEMO_RECEIPT_ID,
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
      result?: { transactionHash?: Hash }[] | string;
    };
    if (payload.status !== "1" || !Array.isArray(payload.result)) return [];
    return [...new Set(payload.result.map((log) => log.transactionHash))].filter(
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
        topics: [null, PUCUK_DEMO_RECEIPT_ID],
      }],
    });
    const hashes = [...new Set(logs.map((log) => log.transactionHash))].filter(
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
) {
  const history = await transactionHistory();
  const allTransactions = [...new Set([...history, ...transactions])];
  return NextResponse.json({
    connected: true,
    exists: receipt !== null,
    receiptId: PUCUK_DEMO_RECEIPT_ID,
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

async function readReceipt() {
  try {
    return await publicClient.readContract({
      address: PUCUK_REGISTRY_ADDRESS,
      abi: pucukRegistryAbi,
      functionName: "getReceipt",
      args: [PUCUK_DEMO_RECEIPT_ID],
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

export async function GET() {
  try {
    const code = await publicClient.getCode({ address: PUCUK_REGISTRY_ADDRESS });
    if (!code) {
      return NextResponse.json(
        { connected: false, error: "Contract not found on Base Sepolia" },
        { status: 503 },
      );
    }
    return responseFor(await readReceipt());
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

    const body = (await request.json()) as { action?: string };
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

    let receipt = await readReceipt();
    if (body.action === "create") {
      if (!receipt) {
        await ensureRole(1);
        await send("createDraft", [
          PUCUK_DEMO_RECEIPT_ID,
          account.address,
          account.address,
          keccak256(stringToHex("PP-2026-000042-commercial-v1")),
          keccak256(stringToHex("PP-2026-000042-evidence-v1")),
          95_625n,
        ]);
        await waitFor(async () => (await readReceipt()) !== null);
        receipt = await readReceipt();
      }
      if (receipt?.state === 0) {
        await ensureRole(1);
        await send("submitForFarmer", [PUCUK_DEMO_RECEIPT_ID]);
        await waitFor(async () => (await readReceipt())?.state === 1);
      }
    } else if (!receipt) {
      return NextResponse.json(
        { error: "Operator must create the demo receipt first" },
        { status: 409 },
      );
    } else if (body.action === "farmerAgree" && receipt.state === 1) {
      await send("farmerAgree", [PUCUK_DEMO_RECEIPT_ID]);
      await waitFor(async () => (await readReceipt())?.state === 2);
    } else if (body.action === "farmerReject" && receipt.state === 1) {
      await send("farmerReject", [
        PUCUK_DEMO_RECEIPT_ID,
        keccak256(stringToHex("farmer-correction-request")),
      ]);
      await waitFor(async () => (await readReceipt())?.state === 0);
    } else if (body.action === "approve" && receipt.state === 2) {
      await ensureRole(2);
      await send("approveLiability", [PUCUK_DEMO_RECEIPT_ID]);
      await waitFor(async () => (await readReceipt())?.state === 3);
    } else if (
      body.action === "pay" &&
      (receipt.state === 3 || receipt.state === 4)
    ) {
      await ensureRole(2);
      const outstanding = await publicClient.readContract({
        address: PUCUK_REGISTRY_ADDRESS,
        abi: pucukRegistryAbi,
        functionName: "outstandingAmount",
        args: [PUCUK_DEMO_RECEIPT_ID],
      });
      await send("recordPayment", [
        PUCUK_DEMO_RECEIPT_ID,
        outstanding,
        keccak256(stringToHex("PP-2026-000042-bank-proof")),
      ]);
      await waitFor(async () => (await readReceipt())?.state === 5);
    } else if (
      body.action === "dispute" &&
      (receipt.state === 2 || receipt.state === 3)
    ) {
      await send("openDispute", [
        PUCUK_DEMO_RECEIPT_ID,
        keccak256(stringToHex("PP-2026-000042-correction-claim")),
      ]);
      await waitFor(async () => (await readReceipt())?.state === 6);
    }

    receipt = await readReceipt();
    return responseFor(receipt, hashes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown registry error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
