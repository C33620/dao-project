import hre from "hardhat";
import fs from "node:fs";
import path from "node:path";

type DeploymentFile = {
  deployer: string;
  governanceToken: string;
  timelock: string;
  governor: string;
  box: string;
  minDelay: number;
  deployedAt: string;
};

async function mineBlocks(provider: any, count: number) {
  for (let i = 0; i < count; i++) {
    await provider.request({
      method: "evm_mine",
      params: [],
    });
  }
}

async function increaseTime(provider: any, seconds: number) {
  await provider.request({
    method: "evm_increaseTime",
    params: [seconds],
  });
  await provider.request({
    method: "evm_mine",
    params: [],
  });
}

function loadDeployment(): DeploymentFile {
  const filePath = path.join(process.cwd(), "deployments", "localhost.json");

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Deployment file not found: ${filePath}\nRun the deploy script first.`,
    );
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as DeploymentFile;
}

async function main() {
  const connection = await hre.network.getOrCreate();
  const { ethers } = connection;
  const provider = connection.provider;
  const [deployer] = await ethers.getSigners();

  const deployment = loadDeployment();

  console.log("Using deployment file: deployments/localhost.json");
  console.log("GovernanceToken:", deployment.governanceToken);
  console.log("Governor:", deployment.governor);
  console.log("Box:", deployment.box);

  const token = await ethers.getContractAt(
    "GovernanceToken",
    deployment.governanceToken,
  );
  const governor = await ethers.getContractAt(
    "MyGovernor",
    deployment.governor,
  );
  const box = await ethers.getContractAt("Box", deployment.box);

  console.log("\nDelegating voting power...");
  await (await token.delegate(deployer.address)).wait();

  const votes = await token.getVotes(deployer.address);
  console.log("Current votes:", votes.toString());

  const newValue = 77;
  const encodedFunctionCall = box.interface.encodeFunctionData("store", [
    newValue,
  ]);
  const description = "Proposal #1: Store 77 in Box";

  console.log("\nCreating proposal...");
  const proposeTx = await governor.propose(
    [deployment.box],
    [0],
    [encodedFunctionCall],
    description,
  );

  const proposeReceipt = await proposeTx.wait();

  const proposalCreatedLog = proposeReceipt!.logs.find((log: any) => {
    try {
      const parsed = governor.interface.parseLog(log);
      return parsed?.name === "ProposalCreated";
    } catch {
      return false;
    }
  });

  if (!proposalCreatedLog) {
    throw new Error("ProposalCreated event not found");
  }

  const parsedLog = governor.interface.parseLog(proposalCreatedLog);
  const proposalId = parsedLog!.args.proposalId;

  console.log("Proposal created with ID:", proposalId.toString());

  console.log("\nMining 1 block for voting delay...");
  await mineBlocks(provider, 1);

  console.log("Casting vote...");
  await (await governor.castVote(proposalId, 1)).wait();

  console.log("Mining voting period blocks...");
  await mineBlocks(provider, 50401);

  const stateAfterVote = await governor.state(proposalId);
  console.log("Proposal state after voting:", stateAfterVote.toString());

  const descriptionHash = ethers.id(description);

  console.log("\nQueueing proposal...");
  await (
    await governor.queue(
      [deployment.box],
      [0],
      [encodedFunctionCall],
      descriptionHash,
    )
  ).wait();

  console.log("Advancing time for timelock delay...");
  await increaseTime(provider, deployment.minDelay + 1);

  console.log("Executing proposal...");
  await (
    await governor.execute(
      [deployment.box],
      [0],
      [encodedFunctionCall],
      descriptionHash,
    )
  ).wait();

  const finalValue = await box.retrieve();
  console.log("\nBox value is now:", finalValue.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
