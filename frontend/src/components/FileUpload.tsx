import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const FileUpload = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState({
    status: "",
    percent: 0,
    processed: 0,
    total: 0,
    last_message: "",
    error: ""
  });

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
      setProgress({
        status: "",
        percent: 0,
        processed: 0,
        total: 0,
        last_message: "",
        error: ""
      });
    }
  };

  const pollProgress = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/progress?job_id=${id}`);
        if (!response.ok) throw new Error("Failed to fetch progress");
        
        const data = await response.json();
        setProgress(data);

        if (data.status === "completed") {
          clearInterval(interval);
          setUploading(false);
          toast({
            title: "Upload complete",
            description: `Successfully processed ${data.processed} products`,
          });
        } else if (data.status === "failed") {
          clearInterval(interval);
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

    return interval;
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
      
      toast({
        title: "Upload started",
        description: "Processing your file...",
      });

      pollProgress(data.job_id);
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

  return (
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
                {progress.status === "completed" ? (
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

            <Progress value={progress.percent} className="h-2" />

            <div className="text-sm text-muted-foreground">
              {progress.last_message}
            </div>

            {progress.error && (
              <div className="text-sm text-destructive">
                Error: {progress.error}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FileUpload;
