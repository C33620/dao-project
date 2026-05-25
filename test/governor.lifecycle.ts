import { expect } from "chai";
import { network } from "hardhat";

describe("Governor lifecycle", function () {
  async function mineBlocks(count: number) {
    const { ethers } = await network.getOrCreate();
    for (let i = 0; i < count; i++) {
      await ethers.provider.send("evm_mine", []);
    }
  }

  async function increaseTime(seconds: number) {
    const { ethers } = await network.getOrCreate();
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  async function deployLifecycleFixture() {
    const { ethers } = await network.getOrCreate();
    const [deployer, voter1, voter2] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockVotesToken");
    const token = await Token.deploy();
    await token.waitForDeployment();

    const Timelock = await ethers.getContractFactory("MyTimelockController");
    const minDelay = 48 * 60 * 60;

    const timelock = await Timelock.deploy(
      minDelay,
      [],
      [ethers.ZeroAddress],
      deployer.address,
    );
    await timelock.waitForDeployment();

    const Governor = await ethers.getContractFactory("MyGovernor");
    const governor = await Governor.deploy(
      await token.getAddress(),
      await timelock.getAddress(),
    );
    await governor.waitForDeployment();

    const votingDelay = Number(await governor.votingDelay());
    const votingPeriod = Number(await governor.votingPeriod());

    const PROPOSER_ROLE = await timelock.getFunction("PROPOSER_ROLE")();
    const EXECUTOR_ROLE = await timelock.getFunction("EXECUTOR_ROLE")();
    const CANCELLER_ROLE = await timelock.getFunction("CANCELLER_ROLE")();
    const DEFAULT_ADMIN_ROLE = await timelock.getFunction(
      "DEFAULT_ADMIN_ROLE",
    )();

    await (
      await timelock.getFunction("grantRole")(
        PROPOSER_ROLE,
        await governor.getAddress(),
      )
    ).wait();

    await (
      await timelock.getFunction("grantRole")(
        EXECUTOR_ROLE,
        await governor.getAddress(),
      )
    ).wait();

    await (
      await timelock.getFunction("grantRole")(
        CANCELLER_ROLE,
        await governor.getAddress(),
      )
    ).wait();

    await (
      await timelock.getFunction("renounceRole")(
        DEFAULT_ADMIN_ROLE,
        deployer.address,
      )
    ).wait();

    const transferAmount = ethers.parseUnits("100000", 18);
    await (await token.transfer(voter1.address, transferAmount)).wait();
    await (await token.transfer(voter2.address, transferAmount)).wait();

    await (await token.connect(deployer).delegate(deployer.address)).wait();
    await (await token.connect(voter1).delegate(voter1.address)).wait();
    await (await token.connect(voter2).delegate(voter2.address)).wait();

    const Box = await ethers.getContractFactory("Box");
    const box = await Box.deploy();
    await box.waitForDeployment();
    await (await box.transferOwnership(await timelock.getAddress())).wait();

    const ProposalRegistry = await ethers.getContractFactory(
      "ProposalRegistry",
    );
    const proposalRegistry = await ProposalRegistry.deploy(
      await timelock.getAddress(),
    );
    await proposalRegistry.waitForDeployment();

    return {
      ethers,
      deployer,
      voter1,
      voter2,
      token,
      timelock,
      governor,
      box,
      proposalRegistry,
      minDelay,
      votingDelay,
      votingPeriod,
    };
  }

  async function moveProposalToActive(governor: any, proposalId: bigint) {
    const votingDelay = Number(await governor.votingDelay());

    expect(await governor.state(proposalId)).to.equal(0n); // Pending

    if (votingDelay > 0) {
      await mineBlocks(votingDelay);
      expect(await governor.state(proposalId)).to.equal(0n); // Still Pending at boundary
    }

    await mineBlocks(1);
    expect(await governor.state(proposalId)).to.equal(1n); // Active
  }

  async function moveProposalToSucceeded(governor: any, proposalId: bigint) {
    const votingPeriod = Number(await governor.votingPeriod());
    await mineBlocks(votingPeriod + 1);
    expect(await governor.state(proposalId)).to.equal(4n); // Succeeded
  }

  it("runs the full propose -> vote -> queue -> execute lifecycle for Box", async function () {
    const { ethers, deployer, voter1, voter2, governor, box, minDelay } =
      await deployLifecycleFixture();

    const valueToStore = 777n;
    const encodedCall = box.interface.encodeFunctionData("store", [
      valueToStore,
    ]);
    const description = "Proposal #1: Store 777 in Box";
    const descriptionHash = ethers.id(description);

    const proposeTx = await governor.propose(
      [await box.getAddress()],
      [0],
      [encodedCall],
      description,
    );
    const proposeReceipt = await proposeTx.wait();

    const proposalCreatedEvent = proposeReceipt!.logs
      .map((log) => {
        try {
          return governor.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((event) => event && event.name === "ProposalCreated");

    if (!proposalCreatedEvent) {
      throw new Error("ProposalCreated event not found");
    }

    const proposalId = proposalCreatedEvent.args.proposalId;

    await moveProposalToActive(governor, proposalId);

    await (await governor.connect(deployer).castVote(proposalId, 1)).wait();
    await (await governor.connect(voter1).castVote(proposalId, 1)).wait();
    await (await governor.connect(voter2).castVote(proposalId, 1)).wait();

    await moveProposalToSucceeded(governor, proposalId);

    await expect(
      governor.execute(
        [await box.getAddress()],
        [0],
        [encodedCall],
        descriptionHash,
      ),
    ).to.be.revert(ethers);

    await (
      await governor.queue(
        [await box.getAddress()],
        [0],
        [encodedCall],
        descriptionHash,
      )
    ).wait();

    expect(await governor.state(proposalId)).to.equal(5n); // Queued

    await expect(
      governor.execute(
        [await box.getAddress()],
        [0],
        [encodedCall],
        descriptionHash,
      ),
    ).to.be.revert(ethers);

    await increaseTime(minDelay + 1);

    await (
      await governor.execute(
        [await box.getAddress()],
        [0],
        [encodedCall],
        descriptionHash,
      )
    ).wait();

    expect(await governor.state(proposalId)).to.equal(7n); // Executed
    expect(await box.retrieve()).to.equal(valueToStore);
  });

  it("runs the full propose -> vote -> queue -> execute lifecycle for ProposalRegistry", async function () {
    const {
      ethers,
      deployer,
      voter1,
      voter2,
      governor,
      proposalRegistry,
      minDelay,
    } = await deployLifecycleFixture();

    const recordedProposalId = 12345n;
    const recordedDescription = "DAO approved treasury diversification policy";
    const recordedProposer = deployer.address;

    const encodedCall = proposalRegistry.interface.encodeFunctionData(
      "recordEntry",
      [recordedProposalId, recordedDescription, recordedProposer],
    );

    const description = "Proposal #2: Record approved DAO decision";
    const descriptionHash = ethers.id(description);

    const proposeTx = await governor.propose(
      [await proposalRegistry.getAddress()],
      [0],
      [encodedCall],
      description,
    );
    const proposeReceipt = await proposeTx.wait();

    const proposalCreatedEvent = proposeReceipt!.logs
      .map((log) => {
        try {
          return governor.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((event) => event && event.name === "ProposalCreated");

    if (!proposalCreatedEvent) {
      throw new Error("ProposalCreated event not found");
    }

    const proposalId = proposalCreatedEvent.args.proposalId;

    await moveProposalToActive(governor, proposalId);

    await (await governor.connect(deployer).castVote(proposalId, 1)).wait();
    await (await governor.connect(voter1).castVote(proposalId, 1)).wait();
    await (await governor.connect(voter2).castVote(proposalId, 1)).wait();

    await moveProposalToSucceeded(governor, proposalId);

    await expect(
      governor.execute(
        [await proposalRegistry.getAddress()],
        [0],
        [encodedCall],
        descriptionHash,
      ),
    ).to.be.revert(ethers);

    await (
      await governor.queue(
        [await proposalRegistry.getAddress()],
        [0],
        [encodedCall],
        descriptionHash,
      )
    ).wait();

    expect(await governor.state(proposalId)).to.equal(5n); // Queued

    await expect(
      governor.execute(
        [await proposalRegistry.getAddress()],
        [0],
        [encodedCall],
        descriptionHash,
      ),
    ).to.be.revert(ethers);

    await increaseTime(minDelay + 1);

    await (
      await governor.execute(
        [await proposalRegistry.getAddress()],
        [0],
        [encodedCall],
        descriptionHash,
      )
    ).wait();

    expect(await governor.state(proposalId)).to.equal(7n); // Executed
    expect(await proposalRegistry.getFunction("entryCount")()).to.equal(1n);

    const entry = await proposalRegistry.getFunction("getEntry")(1n);
    expect(entry.id).to.equal(1n);
    expect(entry.proposalId).to.equal(recordedProposalId);
    expect(entry.description).to.equal(recordedDescription);
    expect(entry.proposer).to.equal(recordedProposer);
    expect(entry.timestamp).to.be.gt(0n);
  });
});
