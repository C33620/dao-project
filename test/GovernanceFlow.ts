import { expect } from "chai";
import hre from "hardhat";

async function mineBlocks(provider: any, count: number) {
  for (let i = 0; i < count; i++) {
    await provider.request({ method: "evm_mine", params: [] });
  }
}

async function increaseTime(provider: any, seconds: number) {
  await provider.request({ method: "evm_increaseTime", params: [seconds] });
  await provider.request({ method: "evm_mine", params: [] });
}

async function deployGovernanceFixture() {
  const { ethers } = await hre.network.getOrCreate();
  const [deployer] = await ethers.getSigners();

  const MIN_DELAY = 3600;

  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  const governanceToken = await GovernanceToken.deploy(deployer.address);
  await governanceToken.waitForDeployment();

  const Timelock = await ethers.getContractFactory("MyTimelockController");
  const timelock = await Timelock.deploy(MIN_DELAY, [], [], deployer.address);
  await timelock.waitForDeployment();

  const Governor = await ethers.getContractFactory("MyGovernor");
  const governor = await Governor.deploy(
    await governanceToken.getAddress(),
    await timelock.getAddress(),
  );
  await governor.waitForDeployment();

  const Box = await ethers.getContractFactory("Box");
  const box = await Box.deploy();
  await box.waitForDeployment();

  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const adminRole = await timelock.DEFAULT_ADMIN_ROLE();

  await (
    await timelock.grantRole(proposerRole, await governor.getAddress())
  ).wait();
  await (await timelock.grantRole(executorRole, ethers.ZeroAddress)).wait();
  await (await box.transferOwnership(await timelock.getAddress())).wait();
  await (await timelock.renounceRole(adminRole, deployer.address)).wait();

  return {
    ethers,
    deployer,
    governanceToken,
    timelock,
    governor,
    box,
    minDelay: MIN_DELAY,
  };
}

describe("DAO Governance Flow", function () {
  it("executes a successful proposal that updates Box", async function () {
    const { ethers, deployer, governanceToken, governor, box, minDelay } =
      await deployGovernanceFixture();

    const connection = await hre.network.getOrCreate();
    const provider = connection.provider;

    await (await governanceToken.delegate(deployer.address)).wait();

    const votes = await governanceToken.getVotes(deployer.address);
    expect(votes).to.be.gt(0n);

    const valueToStore = 77;
    const encodedFunctionCall = box.interface.encodeFunctionData("store", [
      valueToStore,
    ]);
    const description = "Proposal #1: Store 77 in Box";

    const proposeTx = await governor.propose(
      [await box.getAddress()],
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

    const votingDelay = Number(await governor.votingDelay());
    const votingPeriod = Number(await governor.votingPeriod());

    expect(await governor.state(proposalId)).to.equal(0n); // Pending

    if (votingDelay > 0) {
      await mineBlocks(provider, votingDelay);
      expect(await governor.state(proposalId)).to.equal(0n); // Still Pending
    }

    await mineBlocks(provider, 1);
    expect(await governor.state(proposalId)).to.equal(1n); // Active

    await (await governor.castVote(proposalId, 1)).wait();

    await mineBlocks(provider, votingPeriod + 1);
    expect(await governor.state(proposalId)).to.equal(4n); // Succeeded

    const descriptionHash = ethers.id(description);

    await (
      await governor.queue(
        [await box.getAddress()],
        [0],
        [encodedFunctionCall],
        descriptionHash,
      )
    ).wait();

    await increaseTime(provider, minDelay + 1);

    await (
      await governor.execute(
        [await box.getAddress()],
        [0],
        [encodedFunctionCall],
        descriptionHash,
      )
    ).wait();

    expect(await box.retrieve()).to.equal(77n);
  });
});
