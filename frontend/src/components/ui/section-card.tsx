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
    <section className={cn("section-card", className)}>
      {title || description || action ? (
        <header className="section-card__header">
          <div>
            {title ? <h2 className="section-card__title">{title}</h2> : null}
            {description ? (
              <p className="section-card__description">{description}</p>
            ) : null}
          </div>
          {action ? <div className="section-card__action">{action}</div> : null}
        </header>
      ) : null}

      <div className={cn("section-card__content", contentClassName)}>
        {children}
      </div>
    </section>
  );
}
