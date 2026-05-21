import hre from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const { ethers } = await hre.network.getOrCreate();
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with:", deployer.address);

  const MIN_DELAY = 3600;
  const proposers: string[] = [];
  const executors: string[] = [];
  const admin = deployer.address;

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

  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const adminRole = await timelock.DEFAULT_ADMIN_ROLE();

  console.log("Granting roles...");
  await (await timelock.grantRole(proposerRole, governorAddress)).wait();
  await (await timelock.grantRole(executorRole, ethers.ZeroAddress)).wait();

  console.log("Transferring Box ownership to Timelock...");
  await (await box.transferOwnership(timelockAddress)).wait();

  console.log("Renouncing deployer admin role...");
  await (await timelock.renounceRole(adminRole, deployer.address)).wait();

  const deploymentData = {
    deployer: deployer.address,
    governanceToken: governanceTokenAddress,
    timelock: timelockAddress,
    governor: governorAddress,
    box: boxAddress,
    minDelay: MIN_DELAY,
    deployedAt: new Date().toISOString(),
  };

  const deploymentsDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });

  const filePath = path.join(deploymentsDir, "localhost.json");
  fs.writeFileSync(filePath, JSON.stringify(deploymentData, null, 2));

  console.log(`\nDeployment data saved to: ${filePath}`);
  console.log("\nDeployment complete:");
  console.log("GovernanceToken:", governanceTokenAddress);
  console.log("Timelock:", timelockAddress);
  console.log("Governor:", governorAddress);
  console.log("Box:", boxAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
