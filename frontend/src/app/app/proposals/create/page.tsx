import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import CreateProposalClient from "./create-proposal-client";

type CreateProposalPageProps = {
  searchParams?: Promise<{
    from?: string;
  }>;
};

export default async function CreateProposalPage({
  searchParams,
}: CreateProposalPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const from =
    resolvedSearchParams.from === "dashboard" ? "dashboard" : "proposals";

  return (
    <PageShell title="" description="">
      <div className="page-shell__content">
        <SectionCard
          title="Create a proposal"
          description="Prepare a change, review it carefully, and submit it when you are ready."
        >
          <CreateProposalClient origin={from} />
        </SectionCard>
      </div>
    </PageShell>
  );
}
