# DAO Project

A small governance DAO built with Hardhat 3 and OpenZeppelin contracts. Token holders can create proposals, vote on them, queue successful proposals through a timelock, and execute approved decisions on-chain.

## What this project does

This project implements a classic DAO governance lifecycle:

- Create proposals
- Vote on proposals
- Queue successful proposals
- Execute approved decisions after a timelock delay

The current local demo governs a simple `Box` contract, which is used to prove that proposals can be executed end to end through the DAO flow. 

## Governance flow

The governance lifecycle in this project is:

1. A token holder delegates voting power.
2. A proposal is created.
3. Token holders vote during the voting period.
4. If the proposal succeeds, it is queued in the timelock.
5. After the timelock delay, it can be executed.
6. The target contract state is updated on-chain. [web:845][web:843]

## Project structure

```text
contracts/
scripts/
  deploy.ts
  runLifecycle.ts
test/
  GovernanceFlow.ts
deployments/
hardhat.config.ts
```


## Requirements

- Node.js
- npm
- Git

Install dependencies with:

```bash
npm install
```

## Local verification

```bash
npx hardhat test
```

This runs the automated governance test, deploys fresh contracts in a local test environment, and checks the full flow: delegate, propose, vote, queue, execute. 

## Run the project locally

### 1. Compile the contracts

```bash
npx hardhat compile
```

### 2. Start the local blockchain

In the first terminal:

```bash
npx hardhat node
```

Keep this terminal running. Hardhat’s local node provides a persistent local blockchain for deployment and interaction. 

### 3. Deploy the contracts locally

In a second terminal:

```bash
npx hardhat run --network localhost scripts/deploy.ts
```

This deploys the governance token, timelock, governor, and `Box`, then saves the deployment addresses to `deployments/localhost.json`. 

### 4. Run the full governance lifecycle

Still in the second terminal:

```bash
npx hardhat run --network localhost scripts/runLifecycle.ts
```

This script automatically:
- delegates voting power,
- creates a proposal,
- casts a vote,
- advances the voting period,
- queues the proposal,
- advances the timelock delay,
- executes the proposal,
- and confirms that the `Box` value was updated. 



