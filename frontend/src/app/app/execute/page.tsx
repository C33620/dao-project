import { ExecutableProposalsList } from "@/components/governance/executable-proposals-list";
import { QueueableProposalsList } from "@/components/governance/queueable-proposals-list";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";

import {
  getExecutableProposals,
  getQueueableProposals,
} from "@/lib/services/proposals";

export default async function ExecutePage() {
  const [executableProposals, queueableProposals] = await Promise.all([
    getExecutableProposals(),
    getQueueableProposals(),
  ]);

  return (
    <PageShell title="" description="">
      <div className="page-shell__content">
        <SectionCard
          title="Ready to queue"
          description="These proposals passed the vote and must be queued before execution."
        >
          <QueueableProposalsList initialProposals={queueableProposals} />
        </SectionCard>

        <SectionCard
          title="Ready to execute"
          description="These proposals passed the queue and can be executed now."
        >
          <ExecutableProposalsList initialProposals={executableProposals} />
        </SectionCard>
      </div>
    </PageShell>
  );
}
