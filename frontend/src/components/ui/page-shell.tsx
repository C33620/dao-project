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
    <div className={cn("page-shell", className)}>
      <header className="page-shell__header">
        <div className="page-shell__heading">
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="page-shell__actions">{actions}</div> : null}
      </header>

      <div className="page-shell__content">{children}</div>
    </div>
  );
}
