import { useState } from "react";
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
import { Plus, Play, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Webhook {
  id: string;
  url: string;
  event: string;
  enabled: boolean;
}

const WebhookManager = () => {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<Webhook[]>([
    {
      id: "1",
      url: "https://example.com/webhook",
      event: "product.created",
      enabled: true
    }
  ]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    url: "",
    event: "product.created"
  });

  const handleAddWebhook = () => {
    if (!formData.url) {
      toast({
        title: "Error",
        description: "Please enter a webhook URL",
        variant: "destructive"
      });
      return;
    }

    const newWebhook: Webhook = {
      id: Date.now().toString(),
      url: formData.url,
      event: formData.event,
      enabled: true
    };

    setWebhooks([...webhooks, newWebhook]);
    setFormData({ url: "", event: "product.created" });
    setShowForm(false);
    
    toast({
      title: "Webhook added",
      description: "New webhook has been configured"
    });
  };

  const handleTestWebhook = (webhook: Webhook) => {
    toast({
      title: "Testing webhook",
      description: `Sending test request to ${webhook.url}...`
    });
    
    // Simulate test
    setTimeout(() => {
      toast({
        title: "Test successful",
        description: "Webhook responded with 200 OK"
      });
    }, 1000);
  };

  const handleDeleteWebhook = (id: string) => {
    setWebhooks(webhooks.filter(w => w.id !== id));
    toast({
      title: "Webhook deleted",
      description: "Webhook has been removed"
    });
  };

  const handleToggleWebhook = (id: string) => {
    setWebhooks(webhooks.map(w => 
      w.id === id ? { ...w, enabled: !w.enabled } : w
    ));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Webhook Configuration</CardTitle>
            <CardDescription>
              Configure webhooks to receive real-time notifications for product events
            </CardDescription>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Webhook
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">New Webhook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Webhook URL</Label>
                <Input
                  id="url"
                  placeholder="https://your-domain.com/webhook"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event">Event Type</Label>
                <Select
                  value={formData.event}
                  onValueChange={(value) => setFormData({ ...formData, event: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product.created">Product Created</SelectItem>
                    <SelectItem value="product.updated">Product Updated</SelectItem>
                    <SelectItem value="product.deleted">Product Deleted</SelectItem>
                    <SelectItem value="import.completed">Import Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddWebhook}>Add Webhook</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Event</TableHead>
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
                webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-mono text-sm max-w-md truncate">
                      {webhook.url}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{webhook.event}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={webhook.enabled}
                          onCheckedChange={() => handleToggleWebhook(webhook.id)}
                        />
                        <span className="text-sm">
                          {webhook.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestWebhook(webhook)}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Test
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteWebhook(webhook.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="p-4 border border-border rounded-lg bg-muted/50">
          <h4 className="font-medium mb-2">Webhook Events</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p><strong>product.created:</strong> Triggered when a new product is added</p>
            <p><strong>product.updated:</strong> Triggered when a product is modified</p>
            <p><strong>product.deleted:</strong> Triggered when a product is removed</p>
            <p><strong>import.completed:</strong> Triggered when CSV import finishes</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WebhookManager;
