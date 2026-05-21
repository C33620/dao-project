# 🏛️ DAO Project

A small governance DAO built with Hardhat and OpenZeppelin contracts. Token holders can create proposals, vote on them, and execute approved decisions through an on-chain governance flow. 

## ✨ What it does

This project implements a classic DAO lifecycle:

- 📝 Create proposals
- 🗳️ Vote on proposals
- ⏳ Queue successful proposals
- ✅ Execute approved decisions

The goal is to build the governance logic first, test it locally, deploy it to Sepolia, and then connect a frontend for user interaction.

## 🚀 Run locally

### 1. Install dependencies
```bash
npm install
```

### 2. Create your env file
Create a `.env` file at the root of the project:

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
SEPOLIA_PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### 3. Compile contracts
```bash
npx hardhat compile
```

### 4. Run tests
```bash
npx hardhat test
```

### 5. Start a local blockchain
```bash
npx hardhat node
```

### 6. Deploy locally
In a second terminal:

```bash
npx hardhat run --network localhost scripts/deploy.ts
```

## 📌 Notes

- Keep `.env` private and never push it to GitHub.
- Use `.env.example` for placeholder values only.
- After Sepolia deployment, the frontend can use the deployed addresses and ABIs.

After setting the variable, you can run the deployment with the Sepolia network:

```shell
npx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
```
