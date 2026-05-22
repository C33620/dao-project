import { expect } from "chai";
import { network } from "hardhat";
import type {
  Box,
  GovernanceToken,
  MyGovernor,
  MyTimelockController,
} from "../typechain-types/index.js";

describe("Governor defensive and production-token tests", function () {
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

  async function deployProductionFixture() {
    const { ethers } = await network.getOrCreate();
    const [deployer, voter1, voter2, attacker] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("GovernanceToken");
    const token = (await Token.deploy(deployer.address)) as GovernanceToken;
    await token.waitForDeployment();

    const Timelock = await ethers.getContractFactory("MyTimelockController");
    const minDelay = 48 * 60 * 60;

    const timelock = (await Timelock.deploy(
      minDelay,
      [],
      [ethers.ZeroAddress],
      deployer.address,
    )) as MyTimelockController;
    await timelock.waitForDeployment();

    const Governor = await ethers.getContractFactory("MyGovernor");
    const governor = (await Governor.deploy(
      await token.getAddress(),
      await timelock.getAddress(),
    )) as MyGovernor;
    await governor.waitForDeployment();

    const BoxFactory = await ethers.getContractFactory("Box");
    const box = (await BoxFactory.deploy()) as Box;
    await box.waitForDeployment();

    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
    const DEFAULT_ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();

    await (
      await timelock.grantRole(PROPOSER_ROLE, await governor.getAddress())
    ).wait();

    await (
      await timelock.grantRole(EXECUTOR_ROLE, await governor.getAddress())
    ).wait();

    await (
      await timelock.grantRole(CANCELLER_ROLE, await governor.getAddress())
    ).wait();

    await (
      await timelock.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address)
    ).wait();

    await (await box.transferOwnership(await timelock.getAddress())).wait();

    const transferAmount = ethers.parseUnits("100000", 18);
    await (await token.transfer(voter1.address, transferAmount)).wait();
    await (await token.transfer(voter2.address, transferAmount)).wait();

    await (await token.connect(deployer).delegate(deployer.address)).wait();
    await (await token.connect(voter1).delegate(voter1.address)).wait();
    await (await token.connect(voter2).delegate(voter2.address)).wait();

    await mineBlocks(1);

    return {
      ethers,
      deployer,
      voter1,
      voter2,
      attacker,
      token,
      timelock,
      governor,
      box,
      minDelay,
      PROPOSER_ROLE,
      EXECUTOR_ROLE,
      CANCELLER_ROLE,
      DEFAULT_ADMIN_ROLE,
    };
  }

  async function createBoxProposal(
    governor: MyGovernor,
    box: Box,
    ethers: any,
    valueToStore = 777n,
  ) {
    const encodedCall = box.interface.encodeFunctionData("store", [
      valueToStore,
    ]);
    const description = `Proposal: Store ${valueToStore.toString()} in Box`;
    const descriptionHash = ethers.id(description);

    const proposeTx = await governor.propose(
      [await box.getAddress()],
      [0],
      [encodedCall],
      description,
    );
    const proposeReceipt = await proposeTx.wait();

    const proposalCreatedEvent = proposeReceipt!.logs
      .map((log: any) => {
        try {
          return governor.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((event: any) => event && event.name === "ProposalCreated");

    if (!proposalCreatedEvent) {
      throw new Error("ProposalCreated event not found");
    }

    return {
      proposalId: proposalCreatedEvent.args.proposalId,
      encodedCall,
      description,
      descriptionHash,
      valueToStore,
    };
  }

  it("runs the full lifecycle with the production GovernanceToken", async function () {
    const { governor, box, deployer, voter1, voter2, ethers, minDelay } =
      await deployProductionFixture();

    const { proposalId, encodedCall, descriptionHash, valueToStore } =
      await createBoxProposal(governor, box, ethers, 888n);

    expect(await governor.state(proposalId)).to.equal(0n); // Pending

    await mineBlocks(2);
    expect(await governor.state(proposalId)).to.equal(1n); // Active

    await (await governor.connect(deployer).castVote(proposalId, 1)).wait();
    await (await governor.connect(voter1).castVote(proposalId, 1)).wait();
    await (await governor.connect(voter2).castVote(proposalId, 1)).wait();

    await mineBlocks(50401);
    expect(await governor.state(proposalId)).to.equal(4n); // Succeeded

    await (
      await governor.queue(
        [await box.getAddress()],
        [0],
        [encodedCall],
        descriptionHash,
      )
    ).wait();

    expect(await governor.state(proposalId)).to.equal(5n); // Queued

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

  it("prevents direct Box writes after ownership is transferred to the timelock", async function () {
    const { box, deployer } = await deployProductionFixture();

    await expect(
      box.connect(deployer).store(123n),
    ).to.be.revertedWithCustomError(box, "OwnableUnauthorizedAccount");
  });

  it("prevents non-admin accounts from granting timelock roles", async function () {
    const { timelock, attacker, governor, PROPOSER_ROLE, ethers } =
      await deployProductionFixture();

    await expect(
      timelock
        .connect(attacker)
        .grantRole(PROPOSER_ROLE, await governor.getAddress()),
    ).to.be.revert(ethers);
  });

  it("removes deployer admin privileges after renouncing DEFAULT_ADMIN_ROLE", async function () {
    const { timelock, deployer, DEFAULT_ADMIN_ROLE } =
      await deployProductionFixture();

    expect(
      await timelock.hasRole(DEFAULT_ADMIN_ROLE, deployer.address),
    ).to.equal(false);
  });

  it("reverts if queue is attempted before the proposal succeeds", async function () {
    const { governor, box, ethers } = await deployProductionFixture();

    const { encodedCall, descriptionHash } = await createBoxProposal(
      governor,
      box,
      ethers,
      999n,
    );

    await expect(
      governor.queue(
        [await box.getAddress()],
        [0],
        [encodedCall],
        descriptionHash,
      ),
    ).to.be.revert(ethers);
  });

  it("reverts if execute is attempted before queue", async function () {
    const { governor, box, deployer, voter1, voter2, ethers } =
      await deployProductionFixture();

    const { proposalId, encodedCall, descriptionHash } =
      await createBoxProposal(governor, box, ethers, 1001n);

    await mineBlocks(2);

    await (await governor.connect(deployer).castVote(proposalId, 1)).wait();
    await (await governor.connect(voter1).castVote(proposalId, 1)).wait();
    await (await governor.connect(voter2).castVote(proposalId, 1)).wait();

    await mineBlocks(50401);
    expect(await governor.state(proposalId)).to.equal(4n); // Succeeded

    await expect(
      governor.execute(
        [await box.getAddress()],
        [0],
        [encodedCall],
        descriptionHash,
      ),
    ).to.be.revert(ethers);
  });

  it("reverts if execute is attempted before the timelock delay passes", async function () {
    const { governor, box, deployer, voter1, voter2, ethers } =
      await deployProductionFixture();

    const { proposalId, encodedCall, descriptionHash } =
      await createBoxProposal(governor, box, ethers, 1002n);

    await mineBlocks(2);

    await (await governor.connect(deployer).castVote(proposalId, 1)).wait();
    await (await governor.connect(voter1).castVote(proposalId, 1)).wait();
    await (await governor.connect(voter2).castVote(proposalId, 1)).wait();

    await mineBlocks(50401);
    expect(await governor.state(proposalId)).to.equal(4n); // Succeeded

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
  });

  it("marks a proposal as defeated when enough voting power votes against it", async function () {
    const { governor, box, deployer, voter1, voter2, ethers } =
      await deployProductionFixture();

    const { proposalId } = await createBoxProposal(governor, box, ethers, 555n);

    await mineBlocks(2);
    expect(await governor.state(proposalId)).to.equal(1n); // Active

    await (await governor.connect(deployer).castVote(proposalId, 0)).wait();
    await (await governor.connect(voter1).castVote(proposalId, 0)).wait();
    await (await governor.connect(voter2).castVote(proposalId, 0)).wait();

    await mineBlocks(50401);

    expect(await governor.state(proposalId)).to.equal(3n); // Defeated
  });

  it("allows the owner to mint GovernanceToken before any future ownership transfer", async function () {
    const { token, deployer, attacker, ethers } =
      await deployProductionFixture();

    const mintAmount = ethers.parseUnits("1000", 18);
    await (
      await token.connect(deployer).mint(attacker.address, mintAmount)
    ).wait();

    expect(await token.balanceOf(attacker.address)).to.equal(mintAmount);
  });

  it("prevents non-owners from minting GovernanceToken", async function () {
    const { token, attacker } = await deployProductionFixture();

    const { ethers } = await network.getOrCreate();
    const mintAmount = ethers.parseUnits("1000", 18);

    await expect(
      token.connect(attacker).mint(attacker.address, mintAmount),
    ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });

  it("exercises proposalNeedsQueuing by checking a succeeded proposal before queue", async function () {
    const { governor, box, deployer, voter1, voter2, ethers } =
      await deployProductionFixture();

    const { proposalId } = await createBoxProposal(
      governor,
      box,
      ethers,
      4242n,
    );

    await mineBlocks(2);

    await (await governor.connect(deployer).castVote(proposalId, 1)).wait();
    await (await governor.connect(voter1).castVote(proposalId, 1)).wait();
    await (await governor.connect(voter2).castVote(proposalId, 1)).wait();

    await mineBlocks(50401);
    expect(await governor.state(proposalId)).to.equal(4n); // Succeeded

    expect(await governor.proposalNeedsQueuing(proposalId)).to.equal(true);
  });

  it("exercises _cancel override by canceling a proposal and marking it canceled", async function () {
    const { governor, box, ethers } = await deployProductionFixture();

    const { proposalId, encodedCall, descriptionHash } =
      await createBoxProposal(governor, box, ethers, 5151n);

    expect(await governor.state(proposalId)).to.equal(0n); // Pending

    await (
      await governor.cancel(
        [await box.getAddress()],
        [0],
        [encodedCall],
        descriptionHash,
      )
    ).wait();

    expect(await governor.state(proposalId)).to.equal(2n); // Canceled
  });
});
