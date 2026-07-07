import { cn } from "@/lib/utils/cn";
import { ReactNode } from "react";

type PageShellProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
}: PageShellProps) {
  return (
    <div
      className={cn(
        "grid gap-6 w-full max-w-310 mx-auto px-4 sm:px-[0.95rem] min-[900px]:px-6",
        className,
      )}
    >
      <header className="flex gap-4 items-start justify-between flex-wrap">
        <div className="page-shell__heading">
          <h1 className="m-0 text-[clamp(1.9rem,2vw,2.35rem)] leading-[1.02] tracking-[-0.03em]">
            {title}
          </h1>
          {description ? (
            <p className="mt-[0.6rem] mb-0 max-w-[66ch] text-(--muted) text-[0.98rem]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="page-shell__actions">{actions}</div> : null}
      </header>

      <div className="grid gap-5">{children}</div>
    </div>
  );
}
