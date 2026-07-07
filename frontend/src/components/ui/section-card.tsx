import { cn } from "@/lib/utils/cn";
import { ReactNode } from "react";

type SectionCardProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "bg-white/88 border border-(--border) rounded-md shadow-(--shadow-sm) backdrop-blur-md",
        className,
      )}
    >
      {(title || description || action) && (
        <header className="flex gap-4 items-start justify-between flex-wrap pt-[1.3rem] px-[1.3rem]">
          <div>
            {title ? (
              <h2 className="m-0 text-[1.02rem] leading-[1.2] tracking-[-0.02em]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-[0.4rem] mb-0 text-(--muted) text-[0.93rem] leading-[1.55] max-w-[58ch]">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="section-card__action">{action}</div> : null}
        </header>
      )}

      <div className={cn("p-[1.3rem]", contentClassName)}>{children}</div>
    </section>
  );
}
