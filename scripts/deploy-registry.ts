import { network } from "hardhat";

const { viem } = await network.connect();
const [deployer] = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();

const balance = await publicClient.getBalance({ address: deployer.account.address });
if (balance === 0n) {
  throw new Error(`Deployment wallet ${deployer.account.address} has no Base Sepolia ETH`);
}

console.log(`Deploying PucukReceiptRegistry from ${deployer.account.address}`);
console.log(`Wallet balance: ${balance} wei`);

const registry = await viem.deployContract("PucukReceiptRegistry", [
  deployer.account.address,
]);
const deploymentTransactionHash = (
  registry as typeof registry & { deploymentTransactionHash: `0x${string}` }
).deploymentTransactionHash;
console.log(`Contract address: ${registry.address}`);
console.log(`Deployment transaction: ${deploymentTransactionHash}`);

const receipt = await publicClient.waitForTransactionReceipt({
  hash: deploymentTransactionHash,
  confirmations: 1,
  retryCount: 12,
  retryDelay: 2_000,
});

console.log(`Confirmed in block: ${receipt.blockNumber}`);
