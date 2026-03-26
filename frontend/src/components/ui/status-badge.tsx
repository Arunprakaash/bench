import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getStatus } from "@/lib/table-helpers";

interface StatusBadgeProps {
  status: string;
  className?: string;
  uppercase?: boolean;
}

export function StatusBadge({ status, className, uppercase }: StatusBadgeProps) {
  const s = getStatus(status);
  const Icon = s.icon;
  return (
    <Badge
      variant="secondary"
      className={cn(s.badgeClass, className)}
    >
      <Icon
        className={cn("size-3 shrink-0", s.iconClass, s.spin && "animate-spin")}
        aria-hidden="true"
      />
      {uppercase ? status.toUpperCase() : status}
    </Badge>
  );
}
