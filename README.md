# DAO Project

A governance DAO built with Hardhat 3 and OpenZeppelin contracts. Token holders can propose changes, vote on them, queue approved proposals through a timelock, and execute them on-chain.

## Overview

This project implements a standard DAO governance lifecycle around a simple `Box` contract used as the execution target.

Governance flow:
1. Delegate voting power.
2. Create a proposal.
3. Vote during the voting period.
4. Queue a successful proposal in the timelock.
5. Execute it after the timelock delay.
6. Update the target contract state on-chain.

## Contracts

- `GovernanceToken.sol` — governance token with voting power.
- `MyGovernor.sol` — governor contract managing proposals, voting, queueing, execution, and cancellation.
- `MyTimelockController.sol` — timelock enforcing delayed execution.
- `Box.sol` — simple target contract used to verify end-to-end governance execution.
- `MockVotesToken.sol` — helper contract used only for testing.

## Project structure

```text
contracts/
scripts/
  deploy.ts
  runLifecycle.ts
test/
  GovernanceFlow.ts
  Governor.defensive.ts
deployments/
hardhat.config.ts
```

## Requirements

- Node.js
- npm
- Git

Install dependencies:

```bash
npm install
```

## Compile

```bash
npx hardhat compile
```

## Test

Run the full test suite:

```bash
npx hardhat test
```

Run coverage:

```bash
npx hardhat test --coverage
```

## Coverage status

Current coverage results for core contracts:

- `Box.sol` — 100% line / 100% branch
- `GovernanceToken.sol` — 100% line / 100% branch
- `MyGovernor.sol` — 100% line / 100% branch

`MockVotesToken.sol` is a testing helper, so it is not treated as a core production contract for coverage purposes.

## Security review status

The current test suite covers:

- Full governance lifecycle: propose → vote → queue → execute
- Timelock-enforced execution
- Direct write protection on `Box` after ownership transfer
- Owner-only minting on `GovernanceToken`
- Revert behavior for unauthorized mint attempts
- Revert behavior for unauthorized timelock role grants
- Revert behavior for premature queue / execute attempts
- Defeated proposal path
- Proposal cancellation path

## Local workflow

A local deployment and scripted lifecycle flow exist in:

- `scripts/deploy.ts`
- `scripts/runLifecycle.ts`




