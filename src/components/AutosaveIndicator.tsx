import { useEffect, useState } from "react";
import { Check, Cloud, CloudOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface AutosaveIndicatorProps {
  status: SaveStatus;
  className?: string;
}

export const AutosaveIndicator = ({ status, className }: AutosaveIndicatorProps) => {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (status === "saved") {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const displayStatus = status === "saved" && !showSaved ? "idle" : status;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs transition-all duration-300",
        displayStatus === "idle" && "text-muted-foreground/60",
        displayStatus === "saving" && "text-muted-foreground",
        displayStatus === "saved" && "text-green-500",
        displayStatus === "error" && "text-destructive",
        className
      )}
    >
      {displayStatus === "idle" && (
        <>
          <Cloud className="h-3.5 w-3.5" />
          <span>All changes saved</span>
        </>
      )}
      {displayStatus === "saving" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {displayStatus === "saved" && (
        <>
          <Check className="h-3.5 w-3.5" />
          <span>Saved</span>
        </>
      )}
      {displayStatus === "error" && (
        <>
          <CloudOff className="h-3.5 w-3.5" />
          <span>Save failed</span>
        </>
      )}
    </div>
  );
};
