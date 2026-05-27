export type ContractReference = {
  name: string;
  address: string | null;
  abiName: string;
};

export const governanceContracts: ContractReference[] = [
  {
    name: "Governor",
    address: null,
    abiName: "Governor",
  },
  {
    name: "Treasury",
    address: null,
    abiName: "Treasury",
  },
];

// TODO: map deployed contract addresses and ABIs per environment.
