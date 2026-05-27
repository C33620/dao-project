export type GasStatus = {
  refillRequired: boolean | null;
  status: "not_implemented";
};

export async function getGasStatus(): Promise<GasStatus> {
  // TODO: add gas refill checks and threshold monitoring.
  return {
    refillRequired: null,
    status: "not_implemented",
  };
}
