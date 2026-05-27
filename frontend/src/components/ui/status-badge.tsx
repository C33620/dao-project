import { cn } from "@/lib/utils/cn";
import type { StatusTone } from "@/types/governance";

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
  className?: string;
};

export function StatusBadge({
  label,
  tone = "default",
  className,
}: StatusBadgeProps) {
  return (
    <span className={cn("status-badge", `status-badge--${tone}`, className)}>
      <span aria-hidden="true" className="status-badge__dot" />
      <span className="status-badge__label">{label}</span>
    </span>
  );
}
