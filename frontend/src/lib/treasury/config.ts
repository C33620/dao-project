import { Contract, JsonRpcProvider, Wallet, parseUnits } from "ethers";
import "server-only";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;

export type TreasuryReadConfig = {
  chainId: number;
  rpcUrl: string;
  tokenAddress: `0x${string}`;
  tokenDecimals: number;
};

export type TreasuryConfig = TreasuryReadConfig & {
  initialAllocationBaseUnits: string;
  distributionPaused: boolean;
};

export function getTreasuryReadConfig(): TreasuryReadConfig {
  const rpcUrl = process.env.TREASURY_RPC_URL;
  const tokenAddress = process.env.GOVERNANCE_TOKEN_ADDRESS;
  const chainId = Number(process.env.TREASURY_CHAIN_ID ?? 11155111);
  const tokenDecimals = Number(process.env.GOVERNANCE_TOKEN_DECIMALS ?? 18);

  if (!rpcUrl || !tokenAddress) {
    throw new Error("Treasury read configuration is incomplete.");
  }

  return {
    chainId,
    rpcUrl,
    tokenAddress: tokenAddress as `0x${string}`,
    tokenDecimals,
  };
}

export function getTreasuryConfig(): TreasuryConfig {
  const readConfig = getTreasuryReadConfig();
  const privateKey = process.env.TREASURY_PRIVATE_KEY;
  const rawAllocation = process.env.TREASURY_INITIAL_ALLOCATION ?? "1000";
  const distributionPaused =
    String(process.env.TREASURY_DISTRIBUTION_PAUSED ?? "false") === "true";

  if (!privateKey) {
    throw new Error("Treasury configuration is incomplete.");
  }

  return {
    ...readConfig,
    initialAllocationBaseUnits: parseUnits(
      rawAllocation,
      readConfig.tokenDecimals,
    ).toString(),
    distributionPaused,
  };
}

export function createTreasuryProvider() {
  const config = getTreasuryReadConfig();
  return new JsonRpcProvider(config.rpcUrl, config.chainId);
}

export function createTreasurySigner() {
  const privateKey = process.env.TREASURY_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Treasury configuration is incomplete.");
  }

  return new Wallet(privateKey, createTreasuryProvider());
}

export function createGovernanceTokenWriteContract() {
  const signer = createTreasurySigner();
  const { tokenAddress } = getTreasuryReadConfig();

  return new Contract(tokenAddress, ERC20_ABI, signer);
}

export function createGovernanceTokenReadContract() {
  const provider = createTreasuryProvider();
  const { tokenAddress } = getTreasuryReadConfig();

  return new Contract(tokenAddress, ERC20_ABI, provider);
}
