import { SectionCard } from "@/components/ui/section-card";

export function TreasuryQueueSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <SectionCard
        title="Treasury queue"
        description="Loading pending and submitted treasury distributions..."
      >
        <div
          className="grid gap-4"
          aria-hidden="true"
          style={{ minHeight: 420 }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
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
                style={{
                  display: "grid",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    className="bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_25%,rgba(15,23,42,0.12)_50%,rgba(15,23,42,0.06)_75%)] bg-position-[200%_100%] animate-[proposal-skeleton-shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                    style={{
                      height: 14,
                      width: "24%",
                      minWidth: 88,
                      borderRadius: 8,
                    }}
                  />
                  <div
                    className="bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_25%,rgba(15,23,42,0.12)_50%,rgba(15,23,42,0.06)_75%)] bg-position-[200%_100%] animate-[proposal-skeleton-shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                    style={{
                      height: 28,
                      width: 110,
                      borderRadius: 999,
                    }}
                  />
                </div>

                <div
                  className="bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_25%,rgba(15,23,42,0.12)_50%,rgba(15,23,42,0.06)_75%)] bg-position-[200%_100%] animate-[proposal-skeleton-shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                  style={{
                    height: 18,
                    width: "42%",
                    borderRadius: 8,
                  }}
                />

                <div
                  className="bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_25%,rgba(15,23,42,0.12)_50%,rgba(15,23,42,0.06)_75%)] bg-position-[200%_100%] animate-[proposal-skeleton-shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                  style={{
                    height: 14,
                    width: "74%",
                    borderRadius: 8,
                  }}
                />
                <div
                  className="bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_25%,rgba(15,23,42,0.12)_50%,rgba(15,23,42,0.06)_75%)] bg-position-[200%_100%] animate-[proposal-skeleton-shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                  style={{
                    height: 14,
                    width: "58%",
                    borderRadius: 8,
                  }}
                />

                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  }}
                >
                  <div
                    className="bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_25%,rgba(15,23,42,0.12)_50%,rgba(15,23,42,0.06)_75%)] bg-position-[200%_100%] animate-[proposal-skeleton-shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                    style={{
                      height: 44,
                      width: "100%",
                      borderRadius: 12,
                    }}
                  />
                  <div
                    className="bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_25%,rgba(15,23,42,0.12)_50%,rgba(15,23,42,0.06)_75%)] bg-position-[200%_100%] animate-[proposal-skeleton-shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                    style={{
                      height: 44,
                      width: "100%",
                      borderRadius: 12,
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 4,
                  }}
                >
                  <div
                    className="bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_25%,rgba(15,23,42,0.12)_50%,rgba(15,23,42,0.06)_75%)] bg-position-[200%_100%] animate-[proposal-skeleton-shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                    style={{
                      height: 36,
                      width: 148,
                      borderRadius: 999,
                    }}
                  />
                  <div
                    className="bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_25%,rgba(15,23,42,0.12)_50%,rgba(15,23,42,0.06)_75%)] bg-position-[200%_100%] animate-[proposal-skeleton-shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                    style={{
                      height: 36,
                      width: 116,
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
