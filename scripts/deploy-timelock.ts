import { network } from "hardhat";

async function main() {
  const { ethers } = await network.getOrCreate();

  const [deployer, emergencySigner1, emergencySigner2, emergencySigner3] =
    await ethers.getSigners();

  // IMPORTANT:
  // Replace this with your already deployed voting token address,
  // or adapt the script to deploy the token first.
  const TOKEN_ADDRESS = "PASTE_YOUR_TOKEN_ADDRESS_HERE";

  if (TOKEN_ADDRESS === "PASTE_YOUR_TOKEN_ADDRESS_HERE") {
    throw new Error("Set TOKEN_ADDRESS before running the deployment script.");
  }

  const MIN_DELAY = 48 * 60 * 60; // 48 hours

  // Safer final setup:
  // - no initial proposers
  // - open executor role via zero address
  // - deployer is temporary admin only for setup
  const proposers: string[] = [];
  const executors: string[] = [ethers.ZeroAddress];
  const admin = deployer.address;

  console.log("Deploying governance system with:");
  console.log("Deployer:", deployer.address);
  console.log("Token:", TOKEN_ADDRESS);
  console.log("Min delay:", MIN_DELAY);
  console.log("Initial proposers:", proposers);
  console.log("Executors:", executors);
  console.log("Temporary admin:", admin);

  const TimelockController = await ethers.getContractFactory(
    "MyTimelockController",
  );
  const timelock = await TimelockController.deploy(
    MIN_DELAY,
    proposers,
    executors,
    admin,
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();

  console.log("\nTimelockController deployed to:", timelockAddress);

  const Governor = await ethers.getContractFactory("MyGovernor");
  const governor = await Governor.deploy(TOKEN_ADDRESS, timelockAddress);
  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();

  console.log("MyGovernor deployed to:", governorAddress);

  const DEFAULT_ADMIN_ROLE = await timelock.getFunction("DEFAULT_ADMIN_ROLE")();
  const PROPOSER_ROLE = await timelock.getFunction("PROPOSER_ROLE")();
  const EXECUTOR_ROLE = await timelock.getFunction("EXECUTOR_ROLE")();
  const CANCELLER_ROLE = await timelock.getFunction("CANCELLER_ROLE")();

  console.log("\nGranting Governor roles on Timelock...");

  await (
    await timelock.getFunction("grantRole")(PROPOSER_ROLE, governorAddress)
  ).wait();
  await (
    await timelock.getFunction("grantRole")(EXECUTOR_ROLE, governorAddress)
  ).wait();
  await (
    await timelock.getFunction("grantRole")(CANCELLER_ROLE, governorAddress)
  ).wait();

  console.log(
    "Governor granted PROPOSER_ROLE, EXECUTOR_ROLE, and CANCELLER_ROLE.",
  );

  // Optional emergency cancellers.
  // Keep these only if you intentionally want an emergency council outside token voting.
  await (
    await timelock.getFunction("grantRole")(
      CANCELLER_ROLE,
      emergencySigner1.address,
    )
  ).wait();
  await (
    await timelock.getFunction("grantRole")(
      CANCELLER_ROLE,
      emergencySigner2.address,
    )
  ).wait();
  await (
    await timelock.getFunction("grantRole")(
      CANCELLER_ROLE,
      emergencySigner3.address,
    )
  ).wait();

  console.log("\nEmergency cancellers added:");
  console.log("emergencySigner1:", emergencySigner1.address);
  console.log("emergencySigner2:", emergencySigner2.address);
  console.log("emergencySigner3:", emergencySigner3.address);

  // Safety cleanup:
  // if deployer somehow has proposer role, revoke it before renouncing admin
  const deployerIsProposer = await timelock.getFunction("hasRole")(
    PROPOSER_ROLE,
    deployer.address,
  );

  if (deployerIsProposer) {
    console.log("\nRevoking deployer proposer role...");
    await (
      await timelock.getFunction("revokeRole")(PROPOSER_ROLE, deployer.address)
    ).wait();
  }

  console.log("\nRenouncing deployer admin role...");
  await (
    await timelock.getFunction("renounceRole")(
      DEFAULT_ADMIN_ROLE,
      deployer.address,
    )
  ).wait();

  console.log("\nFinal role checks:");
  console.log(
    "Governor has PROPOSER_ROLE:",
    await timelock.getFunction("hasRole")(PROPOSER_ROLE, governorAddress),
  );
  console.log(
    "Governor has EXECUTOR_ROLE:",
    await timelock.getFunction("hasRole")(EXECUTOR_ROLE, governorAddress),
  );
  console.log(
    "Governor has CANCELLER_ROLE:",
    await timelock.getFunction("hasRole")(CANCELLER_ROLE, governorAddress),
  );
  console.log(
    "Zero address has EXECUTOR_ROLE:",
    await timelock.getFunction("hasRole")(EXECUTOR_ROLE, ethers.ZeroAddress),
  );
  console.log(
    "Deployer has DEFAULT_ADMIN_ROLE:",
    await timelock.getFunction("hasRole")(DEFAULT_ADMIN_ROLE, deployer.address),
  );
  console.log(
    "Deployer has PROPOSER_ROLE:",
    await timelock.getFunction("hasRole")(PROPOSER_ROLE, deployer.address),
  );

  const deployerStillAdmin = await timelock.getFunction("hasRole")(
    DEFAULT_ADMIN_ROLE,
    deployer.address,
  );

  if (deployerStillAdmin) {
    throw new Error(
      "Security check failed: deployer still has DEFAULT_ADMIN_ROLE",
    );
  }

  console.log("\nSecurity check passed.");
  console.log("TimelockController:", timelockAddress);
  console.log("MyGovernor:", governorAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
