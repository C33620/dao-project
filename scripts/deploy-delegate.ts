import hre from "hardhat";

async function main() {
  const { ethers } = await hre.network.getOrCreate();

  const governanceToken = "0x5d9A21fE5f8314D8980e6aC1D1AEBFa8185ECFC8";
  const masterWallet = "0x636598a3597dE54B1baf7b30593E2fb52FEeD4Eb";

  const DelegateFactory = await ethers.getContractFactory(
    "CloseAccountDelegate",
  );

  const delegate = await DelegateFactory.deploy(governanceToken, masterWallet);

  await delegate.waitForDeployment();

  const deployedAddress = await delegate.getAddress();

  console.log("CloseAccountDelegate deployed to:", deployedAddress);
  console.log("Governance token:", governanceToken);
  console.log("Master wallet:", masterWallet);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
