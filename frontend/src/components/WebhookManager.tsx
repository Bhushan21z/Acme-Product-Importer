import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Play, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Correct interface for your backend
interface Webhook {
  id: string;
  url: string;
  events: string; // CSV string: "csv.uploaded,csv.completed"
  enabled: string; // "true" / "false"
}

const eventOptions = [
  { id: "csv.uploaded", label: "CSV Uploaded" },
  { id: "csv.started", label: "CSV Started" },
  { id: "csv.completed", label: "CSV Completed" },
  { id: "csv.failed", label: "CSV Failed" },
];

const WebhookManager = () => {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    url: "",
    event: "csv.uploaded"
  });

  // Load existing webhooks
  useEffect(() => {
    fetch(`${API_BASE_URL}/webhooks`)
      .then(res => res.json())
      .then(setWebhooks)
      .catch(() => console.error("Failed to fetch webhooks"));
  }, []);

  const handleAddWebhook = async () => {
    if (!formData.url) {
      toast({
        title: "Error",
        description: "Webhook URL is required",
        variant: "destructive",
      });
      return;
    }

    const res = await fetch(`${API_BASE_URL}/webhooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: formData.url,
        events: [formData.event],
        enabled: true
      })
    });

    if (res.ok) {
      toast({ title: "Webhook added successfully" });
      const updated = await fetch(`${API_BASE_URL}/webhooks`).then(r => r.json());
      setWebhooks(updated);
      setShowForm(false);
      setFormData({ url: "", event: "csv.uploaded" });
    } else {
      toast({
        title: "Error adding webhook",
        variant: "destructive"
      });
    }
  };

  const handleTestWebhook = async (webhook: Webhook) => {
    const res = await fetch(`${API_BASE_URL}/webhooks/${webhook.id}/test`, {
      method: "POST"
    });
    const data = await res.json();

    if (res.ok) {
      toast({
        title: "Webhook Test Successful",
        description: `Response code: ${data.status}`,
      });
    } else {
      toast({
        title: "Webhook Test Failed",
        description: data.error,
        variant: "destructive",
      });
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    await fetch(`${API_BASE_URL}/webhooks/${id}`, { method: "DELETE" });
    const updated = await fetch(`${API_BASE_URL}/webhooks`).then(r => r.json());
    setWebhooks(updated);

    toast({
      title: "Webhook deleted",
      description: "Successfully removed webhook"
    });
  };

  const handleToggleWebhook = async (id: string) => {
    await fetch(`${API_BASE_URL}/webhooks/${id}/toggle`, { method: "POST" });

    const updated = await fetch(`${API_BASE_URL}/webhooks`).then(r => r.json());
    setWebhooks(updated);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Webhook Configuration</CardTitle>
            <CardDescription>
              Manage webhooks for CSV import events
            </CardDescription>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-2" /> Add Webhook
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        
        {/* FORM */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add New Webhook</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  placeholder="https://your-domain.com/webhook"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select
                  value={formData.event}
                  onValueChange={(value) => setFormData({ ...formData, event: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventOptions.map(ev => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddWebhook}>Save</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TABLE */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {webhooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No webhooks configured
                  </TableCell>
                </TableRow>
              ) : (
                webhooks.map((w) => {
                  const events = w.events.split(",");

                  return (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono text-sm max-w-md truncate">
                        {w.url}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {events.map(ev => (
                            <Badge key={ev} variant="outline">{ev}</Badge>
                          ))}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={w.enabled === "true"}
                            onCheckedChange={() => handleToggleWebhook(w.id)}
                          />
                          <span className="text-sm">
                            {w.enabled === "true" ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleTestWebhook(w)}>
                            <Play className="w-4 h-4 mr-1" /> Test
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteWebhook(w.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* EVENT INFO */}
        <div className="p-4 border border-border rounded-lg bg-muted/50">
          <h4 className="font-medium mb-2">Webhook Events</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p><strong>csv.uploaded:</strong> Triggered when CSV file is uploaded</p>
            <p><strong>csv.started:</strong> Triggered when import starts</p>
            <p><strong>csv.completed:</strong> Triggered when CSV import finishes</p>
            <p><strong>csv.failed:</strong> Triggered when import has an error</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WebhookManager;
