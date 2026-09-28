"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { checkUpdates } from "@/lib/actions";
import { toast } from "sonner";

export function CheckUpdatesButton({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const summary = await checkUpdates(projectId);
      toast.success(
        `Checked ${summary.checked}: ${summary.updatable} update(s), ${summary.upToDate} up to date, ${summary.failed} failed`,
      );
      // Reflect the freshly-persisted latest versions in the UI.
      router.refresh();
    } catch {
      toast.error("Update check failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={run} disabled={loading}>
      <RefreshCw className={loading ? "animate-spin" : "h-4 w-4"} />
      {loading ? "Checking…" : "Check for updates"}
    </Button>
  );
}
