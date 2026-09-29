"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { CheckSummary } from "@/lib/actions";

type StreamEvent =
  | { type: "progress"; checked: number; total: number }
  | { type: "done"; summary: CheckSummary }
  | { type: "error"; message?: string };

export interface CheckUpdatesButtonProps {
  projectId: number;
  /** Called once per checked member with the running counts. */
  onProgress?: (checked: number, total: number) => void;
  /** Called with `true` when the check starts and `false` when it settles. */
  onSettle?: (loading: boolean) => void;
}

export function CheckUpdatesButton({
  projectId,
  onProgress,
  onSettle,
}: CheckUpdatesButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const showSummary = (summary: CheckSummary) => {
    toast.success(
      `Checked ${summary.checked}: ${summary.updatable} update(s), ${summary.upToDate} up to date, ${summary.failed} failed`,
    );
    // Reflect the freshly-persisted latest versions in the UI.
    router.refresh();
  };

  const run = async () => {
    setLoading(true);
    onSettle?.(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/check-updates`, { method: "POST" });
      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result = await reader.read();

      // Read the SSE stream incrementally so progress is reported as each
      // member is checked. `done` is only reached after the server's final event.
      while (!result.done) {
        buffer += decoder.decode(result.value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 2);
          const data = chunk.replace(/^data: /, "").trim();
          if (!data) continue;

          let event: StreamEvent;
          try {
            event = JSON.parse(data);
          } catch {
            continue;
          }

          if (event.type === "progress" && event.total && event.total > 0) {
            onProgress?.(event.checked, event.total);
          } else if (event.type === "done" && event.summary) {
            showSummary(event.summary);
          } else if (event.type === "error") {
            toast.error(event.message ?? "Update check failed");
          }
        }

        result = await reader.read();
      }
    } catch {
      toast.error("Update check failed");
    } finally {
      setLoading(false);
      onSettle?.(false);
    }
  };

  return (
    <Button onClick={run} disabled={loading}>
      <RefreshCw className={loading ? "animate-spin" : "h-4 w-4"} />
      {loading ? "Checking…" : "Check for updates"}
    </Button>
  );
}
