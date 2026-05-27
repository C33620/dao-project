export type SyncStatus = {
  indexedProposalCount: number;
  status: "not_implemented";
};

export async function getSyncStatus(): Promise<SyncStatus> {
  // TODO: add proposal sync/indexing orchestration.
  return {
    indexedProposalCount: 0,
    status: "not_implemented",
  };
}
