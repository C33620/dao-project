export type FundingStatus = {
  treasuryBalance: string | null;
  status: "not_implemented";
};

export async function getFundingStatus(): Promise<FundingStatus> {
  // TODO: add treasury funding checks and balance aggregation.
  return {
    treasuryBalance: null,
    status: "not_implemented",
  };
}
