import { SectionCard } from "@/components/ui/section-card";

export function TreasuryQueueSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <SectionCard
        title="Treasury queue"
        description="Loading pending and submitted treasury distributions..."
      >
        <div
          className="dashboard-section-stack"
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
                    className="proposal-skeleton"
                    style={{
                      height: 14,
                      width: "24%",
                      minWidth: 88,
                      borderRadius: 8,
                    }}
                  />
                  <div
                    className="proposal-skeleton"
                    style={{
                      height: 28,
                      width: 110,
                      borderRadius: 999,
                    }}
                  />
                </div>

                <div
                  className="proposal-skeleton proposal-skeleton--title"
                  style={{
                    height: 18,
                    width: "42%",
                    borderRadius: 8,
                  }}
                />

                <div
                  className="proposal-skeleton"
                  style={{
                    height: 14,
                    width: "74%",
                    borderRadius: 8,
                  }}
                />
                <div
                  className="proposal-skeleton"
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
                    className="proposal-skeleton"
                    style={{
                      height: 44,
                      width: "100%",
                      borderRadius: 12,
                    }}
                  />
                  <div
                    className="proposal-skeleton"
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
                    className="proposal-skeleton"
                    style={{
                      height: 36,
                      width: 148,
                      borderRadius: 999,
                    }}
                  />
                  <div
                    className="proposal-skeleton"
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
