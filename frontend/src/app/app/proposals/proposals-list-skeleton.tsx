import { SectionCard } from "@/components/ui/section-card";

export function ProposalsListSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <SectionCard
        title="Open proposals"
        description="Loading active and pending proposals..."
      >
        <div
          className="grid gap-4"
          aria-hidden="true"
          style={{ minHeight: 360 }}
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              style={{
                borderRadius: 12,
                padding: 16,
                background: "rgba(15, 23, 42, 0.03)",
                border: "1px solid rgba(15, 23, 42, 0.06)",
              }}
            >
              <div
                className="bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_25%,rgba(15,23,42,0.12)_50%,rgba(15,23,42,0.06)_75%)] bg-position-[200%_100%] animate-[proposal-skeleton-shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                style={{
                  height: 18,
                  width: "38%",
                  borderRadius: 8,
                  marginBottom: 12,
                }}
              />
              <div
                className="bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_25%,rgba(15,23,42,0.12)_50%,rgba(15,23,42,0.06)_75%)] bg-position-[200%_100%] animate-[proposal-skeleton-shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                style={{
                  height: 14,
                  width: "72%",
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              />
              <div
                className="bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_25%,rgba(15,23,42,0.12)_50%,rgba(15,23,42,0.06)_75%)] bg-position-[200%_100%] animate-[proposal-skeleton-shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                style={{
                  height: 14,
                  width: "56%",
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              />
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <div
                  className="bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_25%,rgba(15,23,42,0.12)_50%,rgba(15,23,42,0.06)_75%)] bg-position-[200%_100%] animate-[proposal-skeleton-shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                  style={{
                    height: 28,
                    width: 92,
                    borderRadius: 999,
                  }}
                />
                <div
                  className="bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_25%,rgba(15,23,42,0.12)_50%,rgba(15,23,42,0.06)_75%)] bg-position-[200%_100%] animate-[proposal-skeleton-shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                  style={{
                    height: 28,
                    width: 120,
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
