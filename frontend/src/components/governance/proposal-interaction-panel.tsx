import { VoteActionCard } from "@/components/governance/vote-action-card";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, titleCase } from "@/lib/utils/format";
import type {
  ExecutionReadinessState,
  ProposalActionState,
  ProposalDetail,
} from "@/types/governance";

type ProposalInteractionPanelProps = {
  proposal: ProposalDetail;
  actionState: ProposalActionState;
  executionState: ExecutionReadinessState;
};

export function ProposalInteractionPanel({
  proposal,
  actionState,
  executionState,
}: ProposalInteractionPanelProps) {
  return (
    <div className="proposal-detail__interaction-stack">
      <SectionCard
        title="Action area"
        description="Mock-safe governance interactions and vote readiness."
      >
        <VoteActionCard proposal={proposal} initialActionState={actionState} />
      </SectionCard>

      <SectionCard
        title="Execution readiness"
        description="Lifecycle state for queueing and execution handling."
      >
        <div className="action-panel">
          <div className="action-panel__row">
            <span>Execution state</span>
            <StatusBadge
              label={executionState.label}
              tone={executionState.tone}
            />
          </div>
          <div className="action-panel__row">
            <span>Lifecycle stage</span>
            <strong>{titleCase(executionState.stage)}</strong>
          </div>
          <div className="action-panel__row">
            <span>Queued at</span>
            <strong>
              {executionState.queuedAt
                ? formatDate(executionState.queuedAt)
                : "Not scheduled"}
            </strong>
          </div>
          <div className="action-panel__row">
            <span>Executable at</span>
            <strong>
              {executionState.executableAt
                ? formatDate(executionState.executableAt)
                : "Not scheduled"}
            </strong>
          </div>
          <div className="action-panel__row">
            <span>Readiness note</span>
            <strong>{executionState.description}</strong>
          </div>
          <div className="button-row">
            <button type="button" className="button button--secondary" disabled>
              Execute in later phase
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
