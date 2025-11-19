import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle, AlertCircle, Repeat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

type ProgressState = {
  status: string;
  percent: number;
  processed: number | string;
  total: number | string;
  last_message: string;
  error: string;
};

type TaskSummary = {
  job_id: string;
  status: string;
  filename: string;
  processed: number;
  total: number;
  last_message: string;
  error: string;
  created_at: number;
  updated_at: number;
  retries: number;
};

const FileUpload = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>({
    status: "",
    percent: 0,
    processed: 0,
    total: 0,
    last_message: "",
    error: ""
  });
  const [tasks, setTasks] = useState<TaskSummary[]>([]);

  // helper to clear polling interval
  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Polling function
  const startPolling = (id: string) => {
    clearPoll();
    // initial immediate fetch
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/progress?job_id=${id}`);
        if (!res.ok) throw new Error("Failed to fetch progress");
        const data = await res.json();
        setProgress(data);
      } catch (e) {
        console.error(e);
      }
    })();

    // poll every second
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/progress?job_id=${id}`);
        if (!response.ok) throw new Error("Failed to fetch progress");
        const data = await response.json();
        setProgress(data);

        if (data.status === "complete") {
          clearPoll();
          setUploading(false);
          toast({
            title: "Upload complete",
            description: `Successfully processed ${data.processed} products`,
          });
        } else if (data.status === "failed") {
          clearPoll();
          setUploading(false);
          toast({
            title: "Upload failed",
            description: data.error || "An error occurred",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Error polling progress:", error);
      }
    }, 1000);

    pollRef.current = intervalId;
  };

  // fetch scheduled tasks on mount
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/scheduled-tasks`);
        if (!res.ok) throw new Error("Failed to fetch scheduled tasks");
        const json = await res.json();
        setTasks(json.tasks || []);
      } catch (e) {
        console.error("Failed to load scheduled tasks", e);
      }
    };
    loadTasks();
    // clear polling on unmount
    return () => {
      clearPoll();
    };
  }, []);

  // when jobId changes, start polling
  useEffect(() => {
    if (jobId) {
      startPolling(jobId);
    } else {
      clearPoll();
      setProgress({
        status: "",
        percent: 0,
        processed: 0,
        total: 0,
        last_message: "",
        error: ""
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast({
          title: "Invalid file",
          description: "Please select a CSV file",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
      setJobId(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      setJobId(data.job_id);

      // refresh scheduled tasks list
      const tasksRes = await fetch(`${API_BASE_URL}/scheduled-tasks`);
      if (tasksRes.ok) {
        const json = await tasksRes.json();
        setTasks(json.tasks || []);
      }

      toast({
        title: "Upload started",
        description: "Processing your file...",
      });

      // start polling
      startPolling(data.job_id);
    } catch (error) {
      console.error("Upload error:", error);
      setUploading(false);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive"
      });
    }
  };

  const attachToJob = (id: string) => {
    setJobId(id);
    setUploading(true);
  };

  const handleRetry = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/retry/${id}`, {
        method: "POST"
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "retry failed" }));
        throw new Error(err.error || "retry failed");
      }
      const json = await res.json();
      toast({ title: "Retry queued", description: `Job ${id} retried.` });
      // refresh tasks list and attach
      const tasksRes = await fetch(`${API_BASE_URL}/scheduled-tasks`);
      if (tasksRes.ok) {
        const tasksJson = await tasksRes.json();
        setTasks(tasksJson.tasks || []);
      }
      setJobId(id);
      setUploading(true);
    } catch (e) {
      toast({ title: "Retry failed", description: e.message || "Retry failed", variant: "destructive" });
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Products CSV</CardTitle>
          <CardDescription>
            Upload a CSV file with up to 500,000 product records. The system will automatically handle duplicates based on SKU.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex items-center gap-3 text-sm">
                <FileText className="w-5 h-5 text-primary" />
                <span className="font-medium">{selectedFile.name}</span>
                <span className="text-muted-foreground">
                  ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
            ) : (
              <Upload className="w-12 h-12 text-muted-foreground" />
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                variant="outline"
              >
                {selectedFile ? "Change File" : "Select File"}
              </Button>

              {selectedFile && (
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              )}
            </div>
          </div>

          {jobId && (
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {progress.status === "complete" ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : progress.status === "failed" ? (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  ) : (
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                  <span className="font-medium capitalize">{progress.status || "Processing"}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {progress.processed} / {progress.total} records
                </span>
              </div>

              <Progress value={Number(progress.percent)} className="h-2" />

              <div className="text-sm text-muted-foreground">
                {progress.last_message}
              </div>

              {progress.error && (
                <div className="text-sm text-destructive">
                  Error: {String(progress.error)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Tasks</CardTitle>
          <CardDescription>
            Previously uploaded import jobs. Click a job to view progress, or retry failed jobs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No import tasks yet.</div>
            ) : tasks.map((t) => (
              <div key={t.job_id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => attachToJob(t.job_id)} className="text-left">
                      <div className="font-medium">{t.filename}</div>
                      <div className="text-sm text-muted-foreground">{t.processed} / {t.total} • {t.status}</div>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {t.status === "failed" ? (
                    <Button size="sm" variant="ghost" onClick={() => handleRetry(t.job_id)}>
                      <Repeat className="w-4 h-4 mr-1" /> Retry
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => attachToJob(t.job_id)}>
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FileUpload;
