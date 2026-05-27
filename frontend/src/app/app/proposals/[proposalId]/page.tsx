import { ProposalDetail } from "@/components/governance/proposal-detail";

type ProposalDetailPageProps = {
  params: {
    proposalId: string;
  };
};

export default function ProposalDetailPage({
  params,
}: ProposalDetailPageProps) {
  const proposalId = params.proposalId;

  return (
    <ProposalDetail
      proposalId={proposalId}
      title={`Governance proposal ${proposalId}`}
      status="Active"
      tone="info"
    />
  );
}
