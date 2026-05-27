export type VoteSubmission = {
  proposalId: string;
  support: "for" | "against" | "abstain";
};

export async function submitVote(input: VoteSubmission) {
  void input;

  // TODO: add wallet-connected vote submission using viem writes.
  return {
    ok: true,
    status: "not_implemented" as const,
  };
}
