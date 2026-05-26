import fs from "fs";
import { artifacts } from "hardhat";
import path from "path";

async function main() {
  const contracts = [
    { name: "Box", artifact: "contracts/Box.sol:Box" },
    { name: "MyGovernor", artifact: "contracts/MyGovernor.sol:MyGovernor" },
    {
      name: "GovernanceToken",
      artifact: "contracts/GovernanceToken.sol:GovernanceToken",
    },
    {
      name: "TimeLock",
      artifact: "contracts/Timelock.sol:MyTimelockController",
    },
    {
      name: "ProposalRegistry",
      artifact: "contracts/ProposalRegistry.sol:ProposalRegistry",
    },
  ];

  const outDir = path.join(process.cwd(), "frontend", "src", "abi");
  fs.mkdirSync(outDir, { recursive: true });

  for (const contract of contracts) {
    const artifact = await artifacts.readArtifact(contract.artifact);
    const outPath = path.join(outDir, `${contract.name}.json`);
    fs.writeFileSync(outPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`Exported ${contract.name} ABI -> ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
