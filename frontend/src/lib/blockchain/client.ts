export type BlockchainClient = {
  chainId: number;
  transport: "placeholder";
};

export function getBlockchainClient(): BlockchainClient {
  // TODO: add viem public/wallet clients for reads and writes.
  return {
    chainId: 1,
    transport: "placeholder",
  };
}
