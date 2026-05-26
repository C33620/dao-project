import { expect } from "chai";
import { network } from "hardhat";

describe("GovernanceToken", function () {
  async function deployGovernanceTokenFixture() {
    const { ethers } = await network.getOrCreate();

    const [owner, addr1, addr2] = await ethers.getSigners();

    const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
    const token = await GovernanceToken.deploy(owner.address);
    await token.waitForDeployment();

    return { ethers, token, owner, addr1, addr2 };
  }

  it("should mint the initial supply to the owner", async function () {
    const { token, owner } = await deployGovernanceTokenFixture();

    const totalSupply = await token.totalSupply();
    const ownerBalance = await token.balanceOf(owner.address);

    expect(ownerBalance).to.equal(totalSupply);
  });

  it("should set the correct owner", async function () {
    const { token, owner } = await deployGovernanceTokenFixture();

    expect(await token.owner()).to.equal(owner.address);
  });

  it("should not expose a public mint function", async function () {
    const { token } = await deployGovernanceTokenFixture();

    const hasMint = token.interface.hasFunction("mint");

    expect(hasMint).to.equal(false);
  });

  it("should have zero voting power before delegation", async function () {
    const { token, owner } = await deployGovernanceTokenFixture();

    expect(await token.getVotes(owner.address)).to.equal(0n);
  });

  it("should give voting power after self-delegation", async function () {
    const { token, owner } = await deployGovernanceTokenFixture();

    await token.delegate(owner.address);

    const votes = await token.getVotes(owner.address);
    const totalSupply = await token.totalSupply();

    expect(votes).to.equal(totalSupply);
  });

  it("should update voting power after transfer and delegation", async function () {
    const { token, owner, addr1 } = await deployGovernanceTokenFixture();

    await token.delegate(owner.address);
    await token.transfer(addr1.address, 1000n);

    expect(await token.getVotes(owner.address)).to.equal(
      (await token.totalSupply()) - 1000n,
    );
    expect(await token.getVotes(addr1.address)).to.equal(0n);

    await token.connect(addr1).delegate(addr1.address);

    expect(await token.getVotes(addr1.address)).to.equal(1000n);
  });
});
