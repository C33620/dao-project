# 🏛️ KyotoTechMeetup DAO

<div align="center">

An on-chain governance DAO built with **Hardhat 3**, **Solidity**, and **OpenZeppelin Governor**. Token holders can delegate voting power, submit proposals, vote on governance decisions, queue approved actions through a timelock, and execute them on-chain through a structured governance lifecycle.


</div>

***

## Table of Contents

## Table of Contents

- [✨ Vision](#vision)
- [🧭 Overview](#overview)
- [🧱 Architecture](#architecture)
- [📦 Repository Structure](#repository-structure)
- [🔗 Deployed Contracts](#deployed-contracts)
- [⚙️ Deployment Model](#deployment-model)
- [🪙 Token Distribution](#token-distribution)
- [🗳️ Governance Lifecycle](#governance-lifecycle)
- [🛡️ Security Review Status](#security-review-status)
- [📊 Coverage](#coverage)
- [🚀 Getting Started](#getting-started)
- [🧪 Sepolia Validation Checklist](#sepolia-validation-checklist)

***
<a id="vision"></a>
## ✨ Vision

KyotoTechMeetup DAO is a governance-focused project exploring how a community can coordinate decisions through transparent, on-chain mechanisms. The goal is to build a clean and credible base for DAO-style coordination, where execution is driven by proposals, voting power, and timelock-controlled actions rather than trust in an admin wallet.

***

<a id="overview"></a>
## 🧭 Overview

This project implements a standard governance lifecycle around a governed execution target and an on-chain proposal registry.

### Governance flow

1. Delegate voting power.
2. Create a proposal.
3. Vote during the voting period.
4. Queue a successful proposal in the timelock.
5. Execute it after the timelock delay.
6. Update target contract state on-chain.

Two governance flows are used to validate the system:

- `Box` proves that governance can execute a state-changing action end to end.
- `ProposalRegistry` proves that executed proposals can also be recorded as readable governance history on-chain.

***
<a id="architecture"></a>
## 🧱 Architecture

The system is split into focused contracts so each governance responsibility remains explicit and auditable.

| Contract | Role |
|---|---|
| `GovernanceToken.sol` | Fixed-supply governance token with voting power enabled through delegation. |
| `MyGovernor.sol` | Core governor contract handling proposals, voting, queueing and execution. |
| `Timelock.sol` | Timelock contract enforcing delayed execution and owning governed target contracts. |
| `Box.sol` | Simple storage target used to verify governance execution from proposal to state change. |
| `ProposalRegistry.sol` | On-chain archive used to record executed proposal entries. |
| `MockVotesToken.sol` | Testing helper contract used only in the test suite. |

***
<a id="repository-structure"></a>
## 📦 Repository Structure

```text
contracts/
  Box.sol
  GovernanceToken.sol
  MockVotesToken.sol
  MyGovernor.sol
  ProposalRegistry.sol
  Timelock.sol
scripts/
  deploy.ts
  runLifecycle.ts
  run-box-flow.ts
  run-registry-flow.ts
test/
  GovernanceFlow.ts
  GovernanceToken.ts
  Governor.defensive.ts
  Governor.lifecycle.ts
  ProposalRegistry.ts
deployments/
hardhat.config.ts
```

The deployment flow is driven by `deploy.ts`, which acts as the source of truth for the Sepolia deployment process.

***
<a id="deployed-contracts"></a>
## 🔗 Deployed Contracts

The current Sepolia deployment is organized so that the governor is wired to the timelock, while the timelock owns governed target contracts such as `Box` and `ProposalRegistry`.

| Contract | Address | Explorer |
|---|---|---|
| GovernanceToken | `0x5d9A21fE5f8314D8980e6aC1D1AEBFa8185ECFC8` | [View on Etherscan](https://sepolia.etherscan.io/address/0x5d9A21fE5f8314D8980e6aC1D1AEBFa8185ECFC8) |
| Timelock | `0x856D887dd70EA2bFc66497B803B7f70fe20fF31b` | [View on Etherscan](https://sepolia.etherscan.io/address/0x856D887dd70EA2bFc66497B803B7f70fe20fF31b) |
| Governor | `0x5e550C752F8d3Ea16B327877538C62a8A3E9AC6c` | [View on Etherscan](https://sepolia.etherscan.io/address/0x5e550C752F8d3Ea16B327877538C62a8A3E9AC6c) |
| Box | `0x25f466ee1054787A328AFF77758d3C8011d3a19F` | [View on Etherscan](https://sepolia.etherscan.io/address/0x25f466ee1054787A328AFF77758d3C8011d3a19F) |
| ProposalRegistry | `0x139DeCfEB250437028D233Ac7c8FC354771f1f22` | [View on Etherscan](https://sepolia.etherscan.io/address/0x139DeCfEB250437028D233Ac7c8FC354771f1f22) |


***
<a id="deployment-model"></a>
## ⚙️ Deployment Model

The deployment script is responsible for more than contract creation. It also wires governance permissions and ownership according to the expected governor-timelock pattern.

### Deployment responsibilities

- Deploy `GovernanceToken` with a fixed constructor-minted supply of `1_000_000 * 10^18` KTM.
- Deploy `MyTimelockController` with `MIN_DELAY = 64800`, `proposers = []`, and `executors = [address(0)]` for open execution.
- Deploy `MyGovernor`, `Box`, and `ProposalRegistry`.
- Save all deployed addresses to `deployments/sepolia.json`.
- Grant `PROPOSER_ROLE` and `CANCELLER_ROLE` to the governor on the timelock.
- Transfer `Box` ownership to the timelock.
- Ensure `ProposalRegistry.owner()` is the timelock from deployment.
- Renounce `DEFAULT_ADMIN_ROLE` from the deployer after setup is complete.

***
<a id="token-distribution"></a>
## 🪙 Token Distribution

KTM distribution on Sepolia is intentionally simple and manual for testing and governance validation.

### Sepolia distribution model

- KTM is minted to the deployer wallet during deployment.
- The deployer acts as the initial master wallet on Sepolia.
- KTM is manually transferred from the deployer to 3–5 test wallets.
- Wallets self-delegate after receiving tokens so balances become active voting power.

> `ERC20Votes` does not automatically treat token balances as active voting power. Self-delegation is required to activate checkpoints and voting weight.

***
<a id="governance-lifecycle"></a>
## 🗳️ Governance Lifecycle

The project validates governance through real multi-step flows on Sepolia rather than only through isolated unit tests.

### Box flow

The Box flow proves that a proposal can successfully modify governed contract state on-chain.

1. Propose a call to `Box.store(77)`.
2. Wait for the proposal to move from `Pending` to `Active`.
3. Vote using delegated wallets.
4. Wait until the proposal reaches `Succeeded`.
5. Queue it through the governor and timelock.
6. Wait for the 18-hour delay.
7. Execute the proposal.
8. Verify that `Box.retrieve()` returns the new value.

### ProposalRegistry flow

The ProposalRegistry flow proves that governance decisions can also be persisted as readable on-chain records.

1. Propose a call to `ProposalRegistry.recordEntry(...)`.
2. Vote, queue, wait for the timelock, and execute.
3. Confirm that `entryCount` increased by exactly `1`.
4. Verify the new entry’s `id`, `proposalId`, `description`, `proposer`, and `timestamp` on-chain.

***
<a id="security-review-status"></a>
## 🛡️ Security Review Status

The current test suite covers the core governance lifecycle as well as several defensive behaviors that matter in a timelock-governed system.

### Covered scenarios

- Full governance lifecycle: `propose → vote → queue → execute`.
- Timelock-enforced execution.
- Direct write protection on `Box` after ownership transfer.
- Owner-only minting checks on `GovernanceToken` based on the current implementation notes.
- Revert behavior for unauthorized mint attempts.
- Revert behavior for unauthorized timelock role grants.
- Revert behavior for premature queue or execute attempts.
- Defeated proposal path.
- Proposal cancellation path in tests.

> For Sepolia v1, the intended public lifecycle remains focused on `propose → vote → queue → execute`.

***
<a id="coverage"></a>
## 📊 Coverage

Coverage is used here as a confidence signal for core production contracts.

| Contract | Coverage |
|---|---|
| `Box.sol` | `100%` line / `100%` branch |
| `GovernanceToken.sol` | `100%` line / `100%` branch |
| `MyGovernor.sol` | `100%` line / `100%` branch |
| `ProposalRegistry.sol` | `100%` line / `100%` branch |

`MockVotesToken.sol` is a testing helper and is therefore not framed as a core production contract in coverage reporting.

***
<a id="getting-started"></a>
## 🚀 Getting Started

### Requirements

- Node.js
- npm
- Git

### Install dependencies

```bash
npm install
```

### Compile

```bash
npx hardhat compile
```

### Run tests

```bash
npx hardhat test
```

### Run coverage

```bash
npx hardhat test --coverage
```

***
<a id="sepolia-validation-checklist"></a>
## 🧪 Sepolia Validation Checklist

Before considering the Sepolia deployment complete, the system should satisfy the following conditions.

- Contracts are deployed and saved to `deployments/sepolia.json`.
- Governor and timelock wiring is verified on-chain.
- `Box` and `ProposalRegistry` are owned by the timelock.
- KTM is distributed to governance test wallets.
- Voting wallets are self-delegated and show active voting power.
- One full `Box` proposal lifecycle succeeds on Sepolia.
- One full `ProposalRegistry` proposal lifecycle succeeds on Sepolia.
***
