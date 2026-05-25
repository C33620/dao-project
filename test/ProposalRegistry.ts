import { expect } from "chai";
import { network } from "hardhat";

describe("ProposalRegistry", function () {
  async function deployProposalRegistryFixture() {
    const { ethers } = await network.getOrCreate();
    const [timelockOwner, addr1, addr2] = await ethers.getSigners();

    const ProposalRegistryFactory = await ethers.getContractFactory(
      "ProposalRegistry",
    );

    const registry = await ProposalRegistryFactory.deploy(
      timelockOwner.address,
    );
    await registry.waitForDeployment();

    return { ethers, registry, timelockOwner, addr1, addr2 };
  }

  it("sets the timelock address as owner in the constructor", async function () {
    const { registry, timelockOwner } = await deployProposalRegistryFixture();

    expect(await registry.getFunction("owner")()).to.equal(
      timelockOwner.address,
    );
  });

  it("starts with zero entries", async function () {
    const { registry } = await deployProposalRegistryFixture();

    expect(await registry.getFunction("entryCount")()).to.equal(0n);
  });

  it("allows only the owner to record an entry", async function () {
    const { registry, timelockOwner, addr1 } =
      await deployProposalRegistryFixture();

    await (
      await registry
        .connect(timelockOwner)
        .recordEntry(1n, "DAO approved treasury policy", timelockOwner.address)
    ).wait();

    await expect(
      registry.connect(addr1).getFunction("recordEntry")(
        2n,
        "Unauthorized attempt",
        addr1.address,
      ),
    ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
  });

  it("reverts when description is empty", async function () {
    const { registry, timelockOwner } = await deployProposalRegistryFixture();

    await expect(
      registry.connect(timelockOwner).getFunction("recordEntry")(
        1n,
        "",
        timelockOwner.address,
      ),
    ).to.be.revertedWith("ProposalRegistry: empty description");
  });

  it("reverts when proposer is the zero address", async function () {
    const { registry, timelockOwner, ethers } =
      await deployProposalRegistryFixture();

    await expect(
      registry.connect(timelockOwner).getFunction("recordEntry")(
        1n,
        "Valid description",
        ethers.ZeroAddress,
      ),
    ).to.be.revertedWith("ProposalRegistry: zero proposer address");
  });

  it("records an entry, increments entryCount, and stores all fields correctly", async function () {
    const { registry, timelockOwner } = await deployProposalRegistryFixture();

    const proposalId = 42n;
    const description = "DAO approved a new grant program";
    const proposer = timelockOwner.address;

    const tx = await registry.connect(timelockOwner).getFunction("recordEntry")(
      proposalId,
      description,
      proposer,
    );
    await tx.wait();

    expect(await registry.getFunction("entryCount")()).to.equal(1n);

    const entry = await registry.getFunction("getEntry")(1n);
    expect(entry.id).to.equal(1n);
    expect(entry.proposalId).to.equal(proposalId);
    expect(entry.description).to.equal(description);
    expect(entry.proposer).to.equal(proposer);
    expect(entry.timestamp).to.be.gt(0n);

    const storedEntry = await registry.getFunction("entries")(1n);
    expect(storedEntry.id).to.equal(1n);
    expect(storedEntry.proposalId).to.equal(proposalId);
    expect(storedEntry.description).to.equal(description);
    expect(storedEntry.proposer).to.equal(proposer);
    expect(storedEntry.timestamp).to.equal(entry.timestamp);
  });

  it("emits EntryRecorded with the expected arguments", async function () {
    const { registry, timelockOwner } = await deployProposalRegistryFixture();

    const proposalId = 77n;
    const description = "DAO approved Box update execution";
    const proposer = timelockOwner.address;

    const tx = await registry.connect(timelockOwner).getFunction("recordEntry")(
      proposalId,
      description,
      proposer,
    );

    const receipt = await tx.wait();

    const entryRecordedLog = receipt!.logs.find((log: any) => {
      try {
        const parsed = registry.interface.parseLog(log);
        return parsed?.name === "EntryRecorded";
      } catch {
        return false;
      }
    });

    if (!entryRecordedLog) {
      throw new Error("EntryRecorded event not found");
    }

    const parsedLog = registry.interface.parseLog(entryRecordedLog);

    expect(parsedLog!.args.id).to.equal(1n);
    expect(parsedLog!.args.proposalId).to.equal(proposalId);
    expect(parsedLog!.args.description).to.equal(description);
    expect(parsedLog!.args.proposer).to.equal(proposer);
    expect(parsedLog!.args.timestamp).to.be.gt(0n);
  });

  it("records multiple entries with sequential 1-indexed ids", async function () {
    const { registry, timelockOwner, addr1 } =
      await deployProposalRegistryFixture();

    await registry.connect(timelockOwner).getFunction("recordEntry")(
      100n,
      "First approved proposal",
      timelockOwner.address,
    );

    await registry.connect(timelockOwner).getFunction("recordEntry")(
      101n,
      "Second approved proposal",
      addr1.address,
    );

    expect(await registry.getFunction("entryCount")()).to.equal(2n);

    const first = await registry.getFunction("getEntry")(1n);
    const second = await registry.getFunction("getEntry")(2n);

    expect(first.id).to.equal(1n);
    expect(first.proposalId).to.equal(100n);
    expect(first.description).to.equal("First approved proposal");
    expect(first.proposer).to.equal(timelockOwner.address);

    expect(second.id).to.equal(2n);
    expect(second.proposalId).to.equal(101n);
    expect(second.description).to.equal("Second approved proposal");
    expect(second.proposer).to.equal(addr1.address);
  });

  it("reverts when getEntry is called with id 0", async function () {
    const { registry } = await deployProposalRegistryFixture();

    await expect(registry.getFunction("getEntry")(0n)).to.be.revertedWith(
      "ProposalRegistry: entry does not exist",
    );
  });

  it("reverts when getEntry is called for a non-existent id", async function () {
    const { registry, timelockOwner } = await deployProposalRegistryFixture();

    await registry.connect(timelockOwner).getFunction("recordEntry")(
      1n,
      "Only one entry exists",
      timelockOwner.address,
    );

    await expect(registry.getFunction("getEntry")(2n)).to.be.revertedWith(
      "ProposalRegistry: entry does not exist",
    );
  });
});
