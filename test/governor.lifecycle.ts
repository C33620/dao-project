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

  it("runs the full propose -> vote -> queue -> execute lifecycle", async function () {
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

    await mineBlocks(1);

    const Box = await ethers.getContractFactory("Box");
    const box = await Box.deploy();
    await box.waitForDeployment();

    await (
      await (box as any).transferOwnership(await timelock.getAddress())
    ).wait();

    const valueToStore = 777n;
    const encodedCall = (box as any).interface.encodeFunctionData("store", [
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

    expect(await governor.state(proposalId)).to.equal(0n); // Pending

    await mineBlocks(1);
    expect(await governor.state(proposalId)).to.equal(0n); // Still Pending

    await mineBlocks(1);
    expect(await governor.state(proposalId)).to.equal(1n); // Active

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
    expect(await (box as any).retrieve()).to.equal(valueToStore);
  });
});
