import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function Loader({
  label = "Loading…",
  size = 20,
  className,
}: {
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="animate-spin" size={size} strokeWidth={2} />
      <span>{label}</span>
    </div>
  );
}

export { Loader };
