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

type Phase = "propose" | "vote" | "queue" | "execute" | "auto";

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

async function getNetworkName(provider: any): Promise<string> {
  const chainIdHex = await provider.request({
    method: "eth_chainId",
    params: [],
  });

  const chainId = Number(chainIdHex);

  if (chainId === 31337) return "localhost";
  return `chain-${chainId}`;
}

function isLocalNetwork(networkName: string) {
  return networkName === "localhost" || networkName === "hardhat";
}

async function loadDeployment(provider: any): Promise<DeploymentFile> {
  const networkName = await getNetworkName(provider);
  const filePath = path.join(
    process.cwd(),
    "deployments",
    `${networkName}.json`,
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Deployment file not found: ${filePath}\nRun the deploy script first for --network ${networkName}.`,
    );
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as DeploymentFile;
}

function expectEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected: ${expected}, got: ${actual}`);
  }
}

function getPhase(networkName: string): Phase {
  const cliPhase = process.env.BOX_FLOW_PHASE as Phase | undefined;

  if (cliPhase) {
    return cliPhase;
  }

  if (!isLocalNetwork(networkName)) {
    return "propose";
  }

  return "auto";
}

function getProposalFilePath(networkName: string) {
  const dir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${networkName}.box-proposal.json`);
}

function saveProposalData(networkName: string, data: any) {
  const filePath = getProposalFilePath(networkName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Proposal data saved to: ${filePath}`);
}

function loadProposalData(networkName: string) {
  const filePath = getProposalFilePath(networkName);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Proposal data file not found: ${filePath}\nRun the propose phase first.`,
    );
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  console.log(`Loaded proposal data from: ${filePath}`);
  return data;
}

async function main() {
  const connection = await hre.network.getOrCreate();
  const { ethers } = connection;
  const provider = connection.provider;
  const [deployer] = await ethers.getSigners();

  const networkName = await getNetworkName(provider);
  const phase = getPhase(networkName);
  const deployment = await loadDeployment(provider);

  console.log("Network:", networkName);
  console.log("Phase:", phase);
  console.log("GovernanceToken:", deployment.governanceToken);
  console.log("Governor:", deployment.governor);
  console.log("Box:", deployment.box);
  console.log("Deployer:", deployer.address);

  const token = await ethers.getContractAt(
    "GovernanceToken",
    deployment.governanceToken,
  );
  const governor = await ethers.getContractAt(
    "MyGovernor",
    deployment.governor,
  );
  const box = await ethers.getContractAt("Box", deployment.box);

  const boxOwner = await box.owner();
  console.log("Box owner:", boxOwner);
  expectEqual(
    boxOwner.toLowerCase(),
    deployment.timelock.toLowerCase(),
    "Box owner must be the timelock",
  );

  const existingVotes = await token.getVotes(deployer.address);
  if (existingVotes === 0n) {
    console.log("\nDelegating voting power...");
    await (await token.delegate(deployer.address)).wait();
  } else {
    console.log("\nVoting power already delegated.");
  }

  const votes = await token.getVotes(deployer.address);
  console.log("Current votes:", votes.toString());

  if (votes === 0n) {
    throw new Error("Deployer has no voting power after delegation.");
  }

  const votingDelay = Number(await governor.votingDelay());
  const votingPeriod = Number(await governor.votingPeriod());

  console.log("Voting delay:", votingDelay);
  console.log("Voting period:", votingPeriod);

  // ✅ new: add threshold check before propose
  const proposalThreshold = await governor.proposalThreshold();
  console.log("Proposal threshold:", proposalThreshold.toString());
  console.log("Proposer votes:", votes.toString());
  console.log("Proposer address:", deployer.address);

  if (votes < proposalThreshold) {
    throw new Error(
      `Not enough votes to propose. Threshold=${proposalThreshold.toString()} votes=${votes.toString()} proposer=${
        deployer.address
      }`,
    );
  }

  const newValue = 77;
  const description = "Proposal #1: Store 77 in Box";
  const descriptionHash = ethers.id(description);
  const encodedFunctionCall = box.interface.encodeFunctionData("store", [
    newValue,
  ]);

  const targets = [deployment.box];
  const values = [0];
  const calldatas = [encodedFunctionCall];

  if (phase === "propose" || phase === "auto") {
    const startingValue = await box.retrieve();
    console.log("Starting Box value:", startingValue.toString());

    console.log("\nCreating proposal...");

    const proposeTx = await governor.propose(
      targets,
      values,
      calldatas,
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

    saveProposalData(networkName, {
      proposalId: proposalId.toString(),
      description,
      descriptionHash,
      targets,
      values,
      calldatas,
      newValue,
    });

    if (phase === "propose" && !isLocalNetwork(networkName)) {
      console.log(
        "Proposal created on public network. " +
          "Wait until governor.state(proposalId) is Active (1), " +
          "then rerun with BOX_FLOW_PHASE=vote.",
      );
      return;
    }

    if (phase === "auto" && isLocalNetwork(networkName)) {
      if (votingDelay > 0) {
        console.log(
          `\nMining ${votingDelay} blocks for voting delay boundary...`,
        );
        await mineBlocks(provider, votingDelay);
      }

      console.log("Mining 1 additional block to move proposal to Active...");
      await mineBlocks(provider, 1);

      const activeState = await governor.state(proposalId);
      console.log("Proposal state before voting:", activeState.toString());
      expectEqual(activeState, 1n, "Proposal must be Active before voting");

      console.log("Casting vote...");
      await (await governor.castVote(proposalId, 1)).wait();

      const proposalVotes = await governor.proposalVotes(proposalId);
      console.log("Votes after casting:");
      console.log("Against:", proposalVotes.againstVotes.toString());
      console.log("For:", proposalVotes.forVotes.toString());
      console.log("Abstain:", proposalVotes.abstainVotes.toString());

      if (proposalVotes.forVotes === 0n) {
        throw new Error("Proposal has zero FOR votes after castVote.");
      }

      console.log(`Mining ${votingPeriod + 1} blocks for voting period...`);
      await mineBlocks(provider, votingPeriod + 1);

      const stateAfterVote = await governor.state(proposalId);
      console.log("Proposal state after voting:", stateAfterVote.toString());
      expectEqual(
        stateAfterVote,
        4n,
        "Proposal must be Succeeded after voting",
      );

      console.log("\nQueueing proposal...");
      await (
        await governor.queue(targets, values, calldatas, descriptionHash)
      ).wait();

      const queuedState = await governor.state(proposalId);
      console.log("Proposal state after queue:", queuedState.toString());
      expectEqual(queuedState, 5n, "Proposal must be Queued after queue");

      console.log("Advancing time for timelock delay...");
      await increaseTime(provider, deployment.minDelay + 1);

      console.log("Executing proposal...");
      await (
        await governor.execute(targets, values, calldatas, descriptionHash)
      ).wait();

      const executedState = await governor.state(proposalId);
      console.log("Proposal state after execution:", executedState.toString());
      expectEqual(
        executedState,
        7n,
        "Proposal must be Executed after execution",
      );

      const finalValue = await box.retrieve();
      console.log("\nBox value is now:", finalValue.toString());
      expectEqual(finalValue, BigInt(newValue), "Final Box value must match");

      console.log("\nBox governance flow completed successfully.");
      return;
    }
  }

  const proposalData = loadProposalData(networkName);
  const proposalId = BigInt(proposalData.proposalId);

  if (phase === "vote") {
    const currentState = await governor.state(proposalId);
    console.log("Current proposal state:", currentState.toString());
    expectEqual(currentState, 1n, "Proposal must be Active before voting");

    console.log("Casting vote...");
    await (await governor.castVote(proposalId, 1)).wait();

    const proposalVotes = await governor.proposalVotes(proposalId);
    console.log("Votes after casting:");
    console.log("Against:", proposalVotes.againstVotes.toString());
    console.log("For:", proposalVotes.forVotes.toString());
    console.log("Abstain:", proposalVotes.abstainVotes.toString());

    if (proposalVotes.forVotes === 0n) {
      throw new Error("Proposal has zero FOR votes after castVote.");
    }

    console.log(
      "Vote cast successfully. " +
        "Wait until governor.state(proposalId) is Succeeded (4), " +
        "then rerun with BOX_FLOW_PHASE=queue.",
    );
    return;
  }

  if (phase === "queue") {
    const currentState = await governor.state(proposalId);
    console.log("Current proposal state:", currentState.toString());
    expectEqual(currentState, 4n, "Proposal must be Succeeded before queue");

    console.log("Queueing proposal...");
    await (
      await governor.queue(
        proposalData.targets,
        proposalData.values,
        proposalData.calldatas,
        proposalData.descriptionHash,
      )
    ).wait();

    const queuedState = await governor.state(proposalId);
    console.log("Proposal state after queue:", queuedState.toString());
    expectEqual(queuedState, 5n, "Proposal must be Queued after queue");

    console.log(
      "Proposal queued successfully. " +
        "Wait until governor.state(proposalId) is still Queued (5) " +
        "and the timelock delay has elapsed, " +
        "then rerun with BOX_FLOW_PHASE=execute.",
    );
    return;
  }

  if (phase === "execute") {
    const currentState = await governor.state(proposalId);
    console.log("Current proposal state:", currentState.toString());
    expectEqual(currentState, 5n, "Proposal must be Queued before execution");

    console.log("Executing proposal...");
    await (
      await governor.execute(
        proposalData.targets,
        proposalData.values,
        proposalData.calldatas,
        proposalData.descriptionHash,
      )
    ).wait();

    const executedState = await governor.state(proposalId);
    console.log("Proposal state after execution:", executedState.toString());
    expectEqual(executedState, 7n, "Proposal must be Executed after execution");

    const finalValue = await box.retrieve();
    console.log("\nBox value is now:", finalValue.toString());
    expectEqual(
      finalValue,
      BigInt(proposalData.newValue),
      "Final Box value must match",
    );

    console.log("\nBox governance flow completed successfully.");
    return;
  }

  throw new Error(`Unsupported phase: ${phase}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
