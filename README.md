# 🏛️ KyotoTechMeetup DAO

<div align="left">



KyotoTechMeetup DAO is an on-chain governance platform designed to help a community capture, discuss, and execute ideas that contribute to its growth.

Community meetups often generate valuable suggestions during conversations, but many of those ideas disappear once the event ends. This project provides a transparent governance system where members can transform ideas into proposals, vote on them using delegated voting power, and execute approved decisions entirely on-chain through a secure timelock-controlled governance process.

Rather than relying on a single organizer or administrator, KyotoTechMeetup DAO gives every participating member a voice in shaping the community. It serves as a foundation for collaborative decision-making, where proposals become part of a permanent on-chain history and successful initiatives can be executed transparently for the benefit of the entire group.

Built with **Hardhat 3**, **Solidity**, and **OpenZeppelin Governor**, the project demonstrates a complete governance lifecycle including proposal creation, voting, timelock queuing, and on-chain execution.



</div>

***


## Table of Contents

- [✨ Key Features](#key-features)
- [🧱 Architecture](#architecture)
- [🔗 Deployed Contracts](#deployed-contracts)
- [⚙️ Deployment Model](#deployment-model)
- [🪙 Token Distribution](#token-distribution)
- [🗳️ Governance Lifecycle](#governance-lifecycle)
- [🛡️ Security Review Status](#security-review-status)
- [📊 Coverage](#coverage)
- [🚀 Getting Started](#getting-started)
- [🧪 Sepolia Validation Checklist](#sepolia-validation-checklist)

 *** 

<a id="key-features"></a>
## ✨ Key Features

### 🧑‍🤝‍🧑 Seamless User Onboarding (Magic Link Auth)

- Users join the platform using a **magic link login flow**
- No wallets or seed phrases required at signup
- Each user is automatically assigned a **magic wallet** after onboarding

### 🏛️ Hybrid Governance System (Admin + DAO)

- A single **admin account manages initial onboarding**
- Admin is the only entity with access to the admin panel
- Every new user triggers a notification in the admin panel requesting token allocation

### 🪙 Equal Token Distribution Model

- All users receive an **equal number of governance tokens**
- Token allocation is controlled through the admin onboarding flow
- Designed to ensure **fair voting power distribution across the community**

### ⚖️ Anti-Abuse Token Rebalancing System

- Automated logic checks user token balances regularly
- If a user receives too many tokens:
  - surplus tokens are automatically returned to the master wallet
- If a user has too few tokens:
  - admin is notified to top up the allocation
- Ensures **consistent fairness across all participants**

### 🗳️ Snapshot-Based Voting System

- Voting power is determined using periodic **snapshots**
- After token rebalancing, users must wait for the next snapshot before voting
- Prevents manipulation of voting power during governance cycles

### 📬 Admin Notification System

- Admin receives real-time messages when:
  - a new user signs up
  - token allocation is required
  - imbalance is detected in token distribution

### 🌐 Full-Stack Governance Application

- Frontend built with **Next.js**
- Backend powered by **MongoDB**
- Smart contracts handle governance execution
- Application bridges Web2 onboarding with Web3 governance

### 🧠 Core Design Philosophy

- Every community member has equal voting power
- Governance remains transparent and auditable on-chain
- Admin role exists only for onboarding, not decision-making
- System actively prevents token imbalance or abuse

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

1. Propose a call to `Box.store()`.
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

 > [!WARNING]
> Before installing dependencies, configure npm to ignore packages published within the last **7 days**. This helps reduce the risk of installing newly published malicious packages as part of a supply-chain attack.
>
> ```bash
> npm config set min-release-age 7
> ```

### Install dependencies

```bash
npm install
```

### Start the development environment

```bash
npm run dev
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
