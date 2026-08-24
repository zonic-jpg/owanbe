import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type CoverJob = {
  id: string;
  status: string;
  batch_size: number;
  processed: number;
  succeeded: number;
  failed: number;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
};

type Counts = {
  pending: number;
  failed_retryable: number;
  failed_terminal: number;
  done: number;
  total: number;
};

const MAX_ATTEMPTS = 3;

export function CoverJobsAdmin() {
  const [running, setRunning] = useState(false);
  const [jobs, setJobs] = useState<CoverJob[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  async function loadStatus() {
    const [{ data: jobRows }, { data: vendorRows }] = await Promise.all([
      supabase
        .from("cover_jobs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10),
      supabase
        .from("vendors")
        .select("cover_status,cover_attempts"),
    ]);
    setJobs((jobRows as CoverJob[]) ?? []);
    if (vendorRows) {
      const c: Counts = {
        pending: 0,
        failed_retryable: 0,
        failed_terminal: 0,
        done: 0,
        total: vendorRows.length,
      };
      for (const v of vendorRows as Array<Record<string, unknown>>) {
        if (v.cover_status === "done") c.done++;
        else if (v.cover_status === "failed") {
          if ((v.cover_attempts ?? 0) >= MAX_ATTEMPTS) c.failed_terminal++;
          else c.failed_retryable++;
        } else c.pending++;
      }
      setCounts(c);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  // Poll while a job is running
  useEffect(() => {
    if (!activeJobId && !running) return;
    const t = setInterval(loadStatus, 2500);
    return () => clearInterval(t);
  }, [activeJobId, running]);

  async function startBatch(batchSize: number) {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-vendor-covers",
        { body: { batch_size: batchSize } },
      );
      if (error) throw error;
      const result = data as {
        job_id: string;
        processed: number;
        succeeded: number;
        failed: number;
        remaining: number;
      };
      setActiveJobId(result.job_id);
      toast.success(
        `Batch done: ${result.succeeded} ok, ${result.failed} failed. ${result.remaining} vendors remaining.`,
      );
      await loadStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Batch failed: ${msg}`);
    } finally {
      setRunning(false);
      setActiveJobId(null);
    }
  }

  async function resetTerminalFailures() {
    const { error } = await supabase
      .from("vendors")
      .update({ cover_status: "pending", cover_attempts: 0, cover_last_error: null })
      .eq("cover_status", "failed")
      .gte("cover_attempts", MAX_ATTEMPTS);
    if (error) toast.error(error.message);
    else {
      toast.success("Reset terminal failures — they will retry on the next batch.");
      loadStatus();
    }
  }

  const pct = counts && counts.total > 0
    ? Math.round((counts.done / counts.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vendor cover generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {counts && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>
                  <strong>{counts.done}</strong> of {counts.total} vendors have generated covers
                </span>
                <span className="font-mono">{pct}%</span>
              </div>
              <Progress value={pct} />
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Pending: {counts.pending}</Badge>
                <Badge variant="secondary">Retryable: {counts.failed_retryable}</Badge>
                <Badge variant="destructive">Terminal: {counts.failed_terminal}</Badge>
                <Badge>Done: {counts.done}</Badge>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => startBatch(50)} disabled={running}>
              {running ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run batch of 50
            </Button>
            <Button
              variant="outline"
              onClick={() => startBatch(10)}
              disabled={running}
            >
              Quick batch (10)
            </Button>
            <Button variant="outline" onClick={loadStatus} disabled={running}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            {counts && counts.failed_terminal > 0 && (
              <Button variant="ghost" onClick={resetTerminalFailures} disabled={running}>
                Reset {counts.failed_terminal} terminal failures
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Each batch processes up to 50 vendors. Failed vendors retry up to {MAX_ATTEMPTS} times automatically.
            Generation takes ~5s per vendor; very large batches may approach the function timeout.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="divide-y">
              {jobs.map((j) => {
                const total = j.batch_size || j.processed || 1;
                const p = Math.round((j.processed / total) * 100);
                return (
                  <div key={j.id} className="py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(j.started_at).toLocaleString()}
                      </span>
                      <Badge variant={j.status === "running" ? "secondary" : j.status === "completed" ? "default" : "destructive"}>
                        {j.status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={p} className="h-2 flex-1" />
                      <span className="text-xs whitespace-nowrap">
                        {j.processed}/{total} · {j.succeeded} ok · {j.failed} failed
                      </span>
                    </div>
                    {j.error_message && (
                      <p className="text-xs text-destructive mt-1">{j.error_message}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
