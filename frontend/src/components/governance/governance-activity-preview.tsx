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
      <div className="grid place-items-center gap-[0.6rem] min-h-45 p-8 text-center bg-white/90 border border-dashed border-(--border-strong) rounded-md">
        <div
          className="w-12 h-12 grid place-items-center rounded-full bg-(--surface-subtle) text-(--muted-soft) text-[1.4rem]"
          aria-hidden="true"
        >
          ≣
        </div>
        <h2 className="m-0 text-[1.1rem] tracking-[-0.02em]">{emptyTitle}</h2>
        <p className="m-0 text-(--muted) max-w-[44ch] leading-[1.6]">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-[0.9rem]">
      {items.map((item) => {
        const isDanger = item.tone === "danger";

        return (
          <article
            key={item.id}
            className="grid grid-cols-[16px_1fr] gap-[0.85rem] items-start"
            style={
              isDanger
                ? {
                    gridTemplateColumns: "16px 1fr",
                  }
                : undefined
            }
          >
            <div
              className="w-[0.7rem] h-[0.7rem] rounded-full bg-[rgb(23,252,2)] mt-[0.45rem] opacity-[0.16]"
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
              className="py-[0.95rem] px-4 rounded-2xl border border-[#e1efdf] bg-[rgba(189,249,184,0.6)]"
              style={
                isDanger
                  ? {
                      borderColor: "rgba(185, 48, 72, 0.24)",
                      background: "rgba(250, 237, 241, 0.62)",
                    }
                  : undefined
              }
            >
              <div className="flex flex-col items-start gap-4 flex-wrap min-[900px]:flex-row min-[900px]:justify-between min-[900px]:items-baseline">
                <h3 className="m-0 text-[0.98rem] tracking-[-0.01em]">
                  {item.title}
                </h3>
                <span className="text-(--muted-soft) text-[0.82rem]">
                  {item.occurredAt}
                </span>
              </div>

              <p className="mt-[0.45rem] text-(--muted) leading-[1.58]">
                {item.description}
              </p>

              {item.relatedProposalCategory ? (
                <p className="mt-[0.45rem] text-(--muted) leading-[1.58]">
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
