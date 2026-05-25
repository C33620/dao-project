// scripts/delegate-votes.ts
import "dotenv/config";
import hre from "hardhat";

async function main() {
  const connection = await hre.network.getOrCreate();
  const { ethers } = connection;
  const provider = connection.provider;

  // Use the Sepolia voter key
  const voterKey = process.env.SEPOLIA_VOTER_PRIVATE_KEY;
  if (!voterKey) {
    throw new Error("SEPOLIA_VOTER_PRIVATE_KEY is not set");
  }

  const wallet = new ethers.Wallet(voterKey, ethers.provider);

  const governanceTokenAddr = "0x5d9A21fE5f8314D8980e6aC1D1AEBFa8185ECFC8";

  const governanceToken = await ethers.getContractAt(
    "GovernanceToken",
    governanceTokenAddr,
    wallet,
  );

  console.log("Voter address:", wallet.address);
  console.log(
    "Current votes:",
    (await governanceToken.getVotes(wallet.address)).toString(),
  );

  console.log("\nDelegating voting power...");
  await (await governanceToken.delegate(wallet.address)).wait();

  console.log("Delegation done.");
  console.log(
    "New votes:",
    (await governanceToken.getVotes(wallet.address)).toString(),
  );

  console.log("\nDelegation OK: this wallet now has active voting power.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
