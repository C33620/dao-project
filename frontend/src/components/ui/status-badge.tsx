import { cn } from "@/lib/utils/cn";

export type StatusTone =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "pending";

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
      {label}
    </span>
  );
}
