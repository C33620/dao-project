import { getProposalCategoryLabel } from "@/lib/governance/create-proposal";
import type { GovernanceActivityItem } from "@/types/governance";

type GovernanceActivityPreviewProps = {
  items: GovernanceActivityItem[];
  emptyTitle?: string;
  emptyDescription?: string;
};

export function GovernanceActivityPreview({
  items,
  emptyTitle = "No voted proposals yet",
  emptyDescription = "Recent voted proposals will appear here once activity exists.",
}: GovernanceActivityPreviewProps) {
  if (items.length === 0) {
    return (
      <div className="empty-state empty-state--compact">
        <div className="empty-state__icon" aria-hidden="true">
          ≣
        </div>
        <h2>{emptyTitle}</h2>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="activity-feed">
      {items.map((item) => {
        const isDanger = item.tone === "danger";

        return (
          <article
            key={item.id}
            className="activity-feed__item"
            style={
              isDanger
                ? {
                    gridTemplateColumns: "16px 1fr",
                  }
                : undefined
            }
          >
            <div
              className="activity-feed__marker"
              aria-hidden="true"
              style={
                isDanger
                  ? {
                      background: "var(--danger)",
                      opacity: 0.9,
                    }
                  : undefined
              }
            />

            <div
              className="activity-feed__content"
              style={
                isDanger
                  ? {
                      borderColor: "rgba(185, 48, 72, 0.24)",
                      background: "rgba(250, 237, 241, 0.62)",
                    }
                  : undefined
              }
            >
              <div className="activity-feed__topline">
                <h3>{item.title}</h3>
                <span>{item.occurredAt}</span>
              </div>

              <p>{item.description}</p>

              {item.relatedProposalCategory ? (
                <p>
                  Category:{" "}
                  {getProposalCategoryLabel(item.relatedProposalCategory)}
                </p>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
