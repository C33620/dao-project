import hre from "hardhat";
import fs from "node:fs";
import path from "node:path";

type DeploymentFile = {
  network: string;
  chainId: number;
  deployer: string;
  governanceToken: string;
  timelock: string;
  governor: string;
  box: string;
  proposalRegistry: string;
  minDelay: number;
  deployedAt: string;
};

function getDeploymentFilePath(networkName: string) {
  const deploymentsDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  return path.join(deploymentsDir, `${networkName}.json`);
}

async function main() {
  const connection = await hre.network.getOrCreate();
  const { ethers } = connection;
  const provider = connection.provider;
  const [deployer] = await ethers.getSigners();

  const chainIdHex = (await provider.request({
    method: "eth_chainId",
    params: [],
  })) as string;
  const chainId = Number(chainIdHex);

  const networkName =
    process.env.HARDHAT_NETWORK ??
    (chainId === 31337 ? "localhost" : `chain-${chainId}`);

  console.log("Deploying contracts with:", deployer.address);
  console.log("Network:", networkName);
  console.log("Chain ID:", chainId);

  const MIN_DELAY = 64800; // 18 hours
  const proposers: string[] = [];
  const executors: string[] = [ethers.ZeroAddress]; // open execution
  const admin = deployer.address; // temporary admin for setup only

  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  const governanceToken = await GovernanceToken.deploy(deployer.address);
  await governanceToken.waitForDeployment();
  const governanceTokenAddress = await governanceToken.getAddress();
  console.log("GovernanceToken deployed to:", governanceTokenAddress);

  const Timelock = await ethers.getContractFactory("MyTimelockController");
  const timelock = await Timelock.deploy(
    MIN_DELAY,
    proposers,
    executors,
    admin,
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("Timelock deployed to:", timelockAddress);

  const Governor = await ethers.getContractFactory("MyGovernor");
  const governor = await Governor.deploy(
    governanceTokenAddress,
    timelockAddress,
  );
  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();
  console.log("Governor deployed to:", governorAddress);

  const Box = await ethers.getContractFactory("Box");
  const box = await Box.deploy();
  await box.waitForDeployment();
  const boxAddress = await box.getAddress();
  console.log("Box deployed to:", boxAddress);

  const ProposalRegistry = await ethers.getContractFactory("ProposalRegistry");
  const proposalRegistry = await ProposalRegistry.deploy(timelockAddress);
  await proposalRegistry.waitForDeployment();
  const proposalRegistryAddress = await proposalRegistry.getAddress();
  console.log("ProposalRegistry deployed to:", proposalRegistryAddress);

  const proposerRole = await timelock.PROPOSER_ROLE();
  const cancellerRole = await timelock.CANCELLER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const adminRole = await timelock.DEFAULT_ADMIN_ROLE();

  console.log("Granting timelock roles to Governor...");
  await (await timelock.grantRole(proposerRole, governorAddress)).wait();
  await (await timelock.grantRole(cancellerRole, governorAddress)).wait();

  console.log("Verifying timelock role assignments...");
  const governorHasProposerRole = await timelock.hasRole(
    proposerRole,
    governorAddress,
  );
  const governorHasCancellerRole = await timelock.hasRole(
    cancellerRole,
    governorAddress,
  );
  const zeroAddressHasExecutorRole = await timelock.hasRole(
    executorRole,
    ethers.ZeroAddress,
  );

  if (!governorHasProposerRole) {
    throw new Error("Governor was not granted PROPOSER_ROLE.");
  }

  if (!governorHasCancellerRole) {
    throw new Error("Governor was not granted CANCELLER_ROLE.");
  }

  if (!zeroAddressHasExecutorRole) {
    throw new Error("EXECUTOR_ROLE is not open to address(0).");
  }

  console.log("Transferring Box ownership to Timelock...");
  await (await box.transferOwnership(timelockAddress)).wait();

  const boxOwner = await box.owner();
  if (boxOwner.toLowerCase() !== timelockAddress.toLowerCase()) {
    throw new Error(
      `Box owner mismatch. Expected ${timelockAddress}, got ${boxOwner}`,
    );
  }

  const registryOwner = await proposalRegistry.owner();
  if (registryOwner.toLowerCase() !== timelockAddress.toLowerCase()) {
    throw new Error(
      `ProposalRegistry owner mismatch. Expected ${timelockAddress}, got ${registryOwner}`,
    );
  }

  console.log("Renouncing deployer admin role...");
  await (await timelock.renounceRole(adminRole, deployer.address)).wait();

  const stillHasAdminRole = await timelock.hasRole(adminRole, deployer.address);
  if (stillHasAdminRole) {
    throw new Error("Deployer still has admin role after renounceRole.");
  }

  const deploymentData: DeploymentFile = {
    network: networkName,
    chainId,
    deployer: deployer.address,
    governanceToken: governanceTokenAddress,
    timelock: timelockAddress,
    governor: governorAddress,
    box: boxAddress,
    proposalRegistry: proposalRegistryAddress,
    minDelay: MIN_DELAY,
    deployedAt: new Date().toISOString(),
  };

  const filePath = getDeploymentFilePath(networkName);
  fs.writeFileSync(filePath, JSON.stringify(deploymentData, null, 2));

  console.log(`\nDeployment data saved to: ${filePath}`);
  console.log("\nDeployment complete:");
  console.log("Network:", networkName);
  console.log("Chain ID:", chainId);
  console.log("GovernanceToken:", governanceTokenAddress);
  console.log("Timelock:", timelockAddress);
  console.log("Governor:", governorAddress);
  console.log("Box:", boxAddress);
  console.log("ProposalRegistry:", proposalRegistryAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
