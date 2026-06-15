import { expect } from "chai";
import type { Log, LogDescription } from "ethers";
import hre from "hardhat";

import type {
  CloseAccountDelegateHarness,
  MockERC20,
  RejectingReceiver,
} from "../typechain-types/index.js";

describe("CloseAccountDelegate", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let networkHelpers: Awaited<
    ReturnType<typeof hre.network.connect>
  >["networkHelpers"];

  before(async function () {
    ({ ethers, networkHelpers } = await hre.network.connect());
  });

  async function deployFixture(): Promise<{
    deployer: any;
    relayer: any;
    signer: any;
    other: any;
    token: MockERC20;
    delegate: CloseAccountDelegateHarness;
  }> {
    const [deployer, relayer, signer, other] = await ethers.getSigners();

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const token = (await MockERC20Factory.deploy()) as unknown as MockERC20;
    await token.waitForDeployment();

    const HarnessFactory = await ethers.getContractFactory(
      "CloseAccountDelegateHarness",
    );
    const delegate = (await HarnessFactory.deploy(
      await token.getAddress(),
      relayer.address,
      signer.address,
    )) as unknown as CloseAccountDelegateHarness;
    await delegate.waitForDeployment();

    return { deployer, relayer, signer, other, token, delegate };
  }

  async function signClose(
    delegate: CloseAccountDelegateHarness,
    signer: any,
    relayer: string,
    nonce: bigint,
    deadline: bigint,
  ) {
    const network = await ethers.provider.getNetwork();

    const domain = {
      name: "CloseAccountDelegate",
      version: "1",
      chainId: Number(network.chainId),
      verifyingContract: await delegate.getAddress(),
    };

    const types = {
      CloseAccount: [
        { name: "relayer", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    return signer.signTypedData(domain, types, {
      relayer,
      nonce,
      deadline,
    });
  }

  async function getCloseExecutedEvent(
    delegate: CloseAccountDelegateHarness,
    tx: Awaited<ReturnType<CloseAccountDelegateHarness["closeAccount"]>>,
  ) {
    const receipt = await tx.wait();
    expect(receipt).to.not.equal(null);

    const decoded: LogDescription[] = [];

    for (const rawLog of receipt!.logs as Log[]) {
      try {
        const parsed = delegate.interface.parseLog({
          topics: rawLog.topics,
          data: rawLog.data,
        });
        if (parsed && parsed.name === "CloseExecuted") {
          decoded.push(parsed);
        }
      } catch {
        continue;
      }
    }

    expect(decoded.length).to.equal(1);
    return decoded[0];
  }

  it("stores constructor addresses", async function () {
    const { token, relayer, delegate } = await deployFixture();

    expect(await delegate.GOVERNANCE_TOKEN()).to.equal(
      await token.getAddress(),
    );
    expect(await delegate.MASTER_WALLET()).to.equal(relayer.address);
  });

  it("reverts on zero constructor addresses", async function () {
    const [_, relayer, signer] = await ethers.getSigners();
    const HarnessFactory = await ethers.getContractFactory(
      "CloseAccountDelegateHarness",
    );

    await expect(
      HarnessFactory.deploy(
        ethers.ZeroAddress,
        relayer.address,
        signer.address,
      ),
    ).to.be.revertedWithCustomError(HarnessFactory, "ZeroAddress");

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20Factory.deploy();
    await token.waitForDeployment();

    await expect(
      HarnessFactory.deploy(
        await token.getAddress(),
        ethers.ZeroAddress,
        signer.address,
      ),
    ).to.be.revertedWithCustomError(HarnessFactory, "ZeroAddress");
  });

  it("computes the same digest as the typed data signer", async function () {
    const { relayer, delegate } = await deployFixture();

    const nonce = 0n;
    const deadline = BigInt((await networkHelpers.time.latest()) + 3600);

    const network = await ethers.provider.getNetwork();
    const domain = {
      name: "CloseAccountDelegate",
      version: "1",
      chainId: Number(network.chainId),
      verifyingContract: await delegate.getAddress(),
    };

    const types = {
      CloseAccount: [
        { name: "relayer", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const offchainDigest = ethers.TypedDataEncoder.hash(domain, types, {
      relayer: relayer.address,
      nonce,
      deadline,
    });

    const onchainDigest = await delegate.getCloseDigest(
      relayer.address,
      nonce,
      deadline,
    );

    expect(onchainDigest).to.equal(offchainDigest);
  });

  it("executes close with valid signature and transfers full balance", async function () {
    const { relayer, signer, token, delegate } = await deployFixture();

    const tokenAmount = ethers.parseEther("14000");
    await token.setBalance(await delegate.getAddress(), tokenAmount);
    await relayer.sendTransaction({
      to: await delegate.getAddress(),
      value: ethers.parseEther("1"),
    });

    const nonce = await delegate.closeNonce();
    const deadline = BigInt((await networkHelpers.time.latest()) + 3600);
    const signature = await signClose(
      delegate,
      signer,
      relayer.address,
      nonce,
      deadline,
    );

    const beforeToken = await token.balanceOf(relayer.address);
    const beforeEth = await ethers.provider.getBalance(relayer.address);

    const tx = await delegate
      .connect(relayer)
      .closeAccount(relayer.address, nonce, deadline, signature, {
        gasPrice: ethers.parseUnits("1", "gwei"),
      });

    const closeEvent = await getCloseExecutedEvent(delegate, tx);

    expect(closeEvent.args[0]).to.equal(relayer.address);
    expect(closeEvent.args[1]).to.equal(relayer.address);
    expect(closeEvent.args[2]).to.equal(tokenAmount);
    expect(closeEvent.args[3]).to.be.greaterThan(0n);
    expect(closeEvent.args[4]).to.equal(nonce);

    expect(await token.balanceOf(relayer.address)).to.equal(
      beforeToken + tokenAmount,
    );
    expect(await token.balanceOf(await delegate.getAddress())).to.equal(0n);
    expect(await delegate.closeNonce()).to.equal(1n);

    const afterEth = await ethers.provider.getBalance(relayer.address);
    expect(afterEth).to.be.greaterThan(beforeEth);
  });

  it("sweeps balances larger than the old fixed amount", async function () {
    const { relayer, signer, token, delegate } = await deployFixture();

    const tokenAmount = ethers.parseEther("15000");
    await token.setBalance(await delegate.getAddress(), tokenAmount);
    await relayer.sendTransaction({
      to: await delegate.getAddress(),
      value: ethers.parseEther("1"),
    });

    const nonce = await delegate.closeNonce();
    const deadline = BigInt((await networkHelpers.time.latest()) + 3600);
    const signature = await signClose(
      delegate,
      signer,
      relayer.address,
      nonce,
      deadline,
    );

    await delegate
      .connect(relayer)
      .closeAccount(relayer.address, nonce, deadline, signature, {
        gasPrice: ethers.parseUnits("1", "gwei"),
      });

    expect(await token.balanceOf(relayer.address)).to.equal(tokenAmount);
    expect(await token.balanceOf(await delegate.getAddress())).to.equal(0n);
  });

  it("rejects wrong relayer", async function () {
    const { relayer, signer, other, delegate } = await deployFixture();

    const nonce = await delegate.closeNonce();
    const deadline = BigInt((await networkHelpers.time.latest()) + 3600);
    const signature = await signClose(
      delegate,
      signer,
      relayer.address,
      nonce,
      deadline,
    );

    await expect(
      delegate
        .connect(other)
        .closeAccount(relayer.address, nonce, deadline, signature),
    ).to.be.revertedWithCustomError(delegate, "InvalidRelayer");
  });

  it("rejects expired signature", async function () {
    const { relayer, signer, delegate } = await deployFixture();

    const nonce = await delegate.closeNonce();
    const deadline = BigInt((await networkHelpers.time.latest()) + 10);
    const signature = await signClose(
      delegate,
      signer,
      relayer.address,
      nonce,
      deadline,
    );

    await networkHelpers.time.increase(11);

    await expect(
      delegate
        .connect(relayer)
        .closeAccount(relayer.address, nonce, deadline, signature),
    ).to.be.revertedWithCustomError(delegate, "SignatureExpired");
  });

  it("rejects invalid nonce", async function () {
    const { relayer, signer, delegate } = await deployFixture();

    const deadline = BigInt((await networkHelpers.time.latest()) + 3600);
    const signature = await signClose(
      delegate,
      signer,
      relayer.address,
      7n,
      deadline,
    );

    await expect(
      delegate
        .connect(relayer)
        .closeAccount(relayer.address, 7n, deadline, signature),
    ).to.be.revertedWithCustomError(delegate, "InvalidNonce");
  });

  it("rejects replay", async function () {
    const { relayer, signer, token, delegate } = await deployFixture();

    const tokenAmount = ethers.parseEther("2000");
    await token.setBalance(await delegate.getAddress(), tokenAmount);
    await relayer.sendTransaction({
      to: await delegate.getAddress(),
      value: ethers.parseEther("2"),
    });

    const nonce = await delegate.closeNonce();
    const deadline = BigInt((await networkHelpers.time.latest()) + 3600);
    const signature = await signClose(
      delegate,
      signer,
      relayer.address,
      nonce,
      deadline,
    );

    await delegate
      .connect(relayer)
      .closeAccount(relayer.address, nonce, deadline, signature, {
        gasPrice: ethers.parseUnits("1", "gwei"),
      });

    await expect(
      delegate
        .connect(relayer)
        .closeAccount(relayer.address, nonce, deadline, signature, {
          gasPrice: ethers.parseUnits("1", "gwei"),
        }),
    ).to.be.revertedWithCustomError(delegate, "InvalidNonce");
  });

  it("reverts when token balance is zero", async function () {
    const { relayer, signer, token, delegate } = await deployFixture();

    await token.setBalance(await delegate.getAddress(), 0);
    await relayer.sendTransaction({
      to: await delegate.getAddress(),
      value: ethers.parseEther("1"),
    });

    const nonce = await delegate.closeNonce();
    const deadline = BigInt((await networkHelpers.time.latest()) + 3600);
    const signature = await signClose(
      delegate,
      signer,
      relayer.address,
      nonce,
      deadline,
    );

    await expect(
      delegate
        .connect(relayer)
        .closeAccount(relayer.address, nonce, deadline, signature, {
          gasPrice: ethers.parseUnits("1", "gwei"),
        }),
    ).to.be.revertedWithCustomError(delegate, "InsufficientTokenBalance");
  });

  it("reverts when eth is too low for reserve", async function () {
    const { relayer, signer, token, delegate } = await deployFixture();

    await token.setBalance(await delegate.getAddress(), ethers.parseEther("1"));

    const nonce = await delegate.closeNonce();
    const deadline = BigInt((await networkHelpers.time.latest()) + 3600);
    const signature = await signClose(
      delegate,
      signer,
      relayer.address,
      nonce,
      deadline,
    );

    await expect(
      delegate
        .connect(relayer)
        .closeAccount(relayer.address, nonce, deadline, signature, {
          gasPrice: ethers.parseUnits("100", "gwei"),
        }),
    ).to.be.revertedWithCustomError(delegate, "InsufficientEthBalance");
  });

  it("reverts when master wallet rejects eth", async function () {
    const [_, relayer, signer] = await ethers.getSigners();

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const token = (await MockERC20Factory.deploy()) as unknown as MockERC20;
    await token.waitForDeployment();

    const RejectingReceiverFactory = await ethers.getContractFactory(
      "RejectingReceiver",
    );
    const rejecting =
      (await RejectingReceiverFactory.deploy()) as unknown as RejectingReceiver;
    await rejecting.waitForDeployment();

    const HarnessFactory = await ethers.getContractFactory(
      "CloseAccountDelegateHarness",
    );
    const delegate = (await HarnessFactory.deploy(
      await token.getAddress(),
      await rejecting.getAddress(),
      signer.address,
    )) as unknown as CloseAccountDelegateHarness;
    await delegate.waitForDeployment();

    await token.setBalance(await delegate.getAddress(), ethers.parseEther("1"));
    await relayer.sendTransaction({
      to: await delegate.getAddress(),
      value: ethers.parseEther("1"),
    });

    const nonce = await delegate.closeNonce();
    const deadline = BigInt((await networkHelpers.time.latest()) + 3600);
    const signature = await signClose(
      delegate,
      signer,
      relayer.address,
      nonce,
      deadline,
    );

    await expect(
      delegate
        .connect(relayer)
        .closeAccount(relayer.address, nonce, deadline, signature, {
          gasPrice: ethers.parseUnits("1", "gwei"),
        }),
    ).to.be.revertedWithCustomError(delegate, "EthTransferFailed");
  });

  it("rejects invalid signer", async function () {
    const { relayer, other, token, delegate } = await deployFixture();

    await token.setBalance(await delegate.getAddress(), ethers.parseEther("1"));
    await relayer.sendTransaction({
      to: await delegate.getAddress(),
      value: ethers.parseEther("1"),
    });

    const nonce = await delegate.closeNonce();
    const deadline = BigInt((await networkHelpers.time.latest()) + 3600);
    const signature = await signClose(
      delegate,
      other,
      relayer.address,
      nonce,
      deadline,
    );

    await expect(
      delegate
        .connect(relayer)
        .closeAccount(relayer.address, nonce, deadline, signature, {
          gasPrice: ethers.parseUnits("1", "gwei"),
        }),
    ).to.be.revertedWithCustomError(delegate, "InvalidSignature");
  });

  it("reverts on exact zero eth balance", async function () {
    const { relayer, signer, token, delegate } = await deployFixture();

    await token.setBalance(await delegate.getAddress(), ethers.parseEther("1"));

    const nonce = await delegate.closeNonce();
    const deadline = BigInt((await networkHelpers.time.latest()) + 3600);
    const signature = await signClose(
      delegate,
      signer,
      relayer.address,
      nonce,
      deadline,
    );

    await expect(
      delegate
        .connect(relayer)
        .closeAccount(relayer.address, nonce, deadline, signature, {
          gasPrice: 0,
        }),
    ).to.be.revertedWithCustomError(delegate, "InsufficientEthBalance");
  });

  it("reverts when token transfer returns false", async function () {
    const { relayer, signer, token, delegate } = await deployFixture();

    await token.setBalance(await delegate.getAddress(), ethers.parseEther("1"));
    await token.setFailTransfer(true);
    await relayer.sendTransaction({
      to: await delegate.getAddress(),
      value: ethers.parseEther("1"),
    });

    const nonce = await delegate.closeNonce();
    const deadline = BigInt((await networkHelpers.time.latest()) + 3600);
    const signature = await signClose(
      delegate,
      signer,
      relayer.address,
      nonce,
      deadline,
    );

    await expect(
      delegate
        .connect(relayer)
        .closeAccount(relayer.address, nonce, deadline, signature, {
          gasPrice: ethers.parseUnits("1", "gwei"),
        }),
    ).to.revert(ethers);
  });
});
