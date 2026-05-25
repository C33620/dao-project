// scripts/debug-network.ts
import hre from "hardhat";

async function main() {
  const connection = await hre.network.getOrCreate();
  const { ethers } = connection;
  const provider = connection.provider;
  const [signer] = await ethers.getSigners();

  const chainId = await provider.request({
    method: "eth_chainId",
    params: [],
  });

  console.log("Chain ID:", chainId);
  console.log("First signer address:", await signer.getAddress());
  console.log("Configured networks:", Object.keys(hre.config.networks));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
