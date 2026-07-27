import hre from "hardhat";
import { verifyContract } from "@nomicfoundation/hardhat-verify/verify";

const address = "0x18708aE53414044F7651D7aA4982494bcb2E21b2";
const owner = "0xbCcBD9daD1E2cBC84eE46cEfF97256f7663C0F3b";
const provider = process.env.ETHERSCAN_API_KEY ? "etherscan" : "sourcify";

console.log(`Verifying ${address} through ${provider}...`);

await verifyContract(
  {
    address,
    constructorArgs: [owner],
    provider,
  },
  hre,
);

console.log(`Verification submitted successfully through ${provider}.`);
