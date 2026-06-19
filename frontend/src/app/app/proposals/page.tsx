import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { Suspense } from "react";
import { CancelProposalEntryCard } from "./components/cancel-proposal-entry-card";
import { CreateProposalEntryCard } from "./components/create-proposal-entry-card";
import { ProposalsAutoRefresh } from "./components/proposals-auto-refresh";
import { ProposalsListSection } from "./proposals-list-section";
import { ProposalsListSkeleton } from "./proposals-list-skeleton";

export default function ProposalsPage() {
  return (
    <PageShell title="" description="">
      <ProposalsAutoRefresh />

      <div className="page-shell__content">
        <SectionCard
          title="Create a proposal"
          description="Write a proposal for the group to review and vote on."
        >
          <div className="dashboard-section-stack">
            <CreateProposalEntryCard origin="proposals" description="" />
          </div>
        </SectionCard>

        <SectionCard
          title="Cancel a proposal"
          description="Cancel an existing proposal."
        >
          <div className="dashboard-section-stack">
            <CancelProposalEntryCard origin="proposals" description="" />
          </div>
        </SectionCard>

        <Suspense fallback={<ProposalsListSkeleton />}>
          <ProposalsListSection />
        </Suspense>
      </div>
    </PageShell>
  );
}
