import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Upload, Database, Webhook, CheckCircle } from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4 animate-in fade-in duration-700">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Product Importer
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Efficiently import, manage, and sync hundreds of thousands of products with ease.
            </p>
          </div>

          <div className="flex justify-center gap-4 animate-in fade-in duration-700 delay-200">
            <Button 
              size="lg" 
              onClick={() => navigate("/dashboard")}
              className="text-lg px-8 shadow-lg hover:shadow-xl transition-all"
            >
              Get Started
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-16 animate-in fade-in duration-700 delay-300">
            <div className="p-6 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors">
              <Upload className="w-12 h-12 text-primary mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">Bulk Upload</h3>
              <p className="text-sm text-muted-foreground">
                Import up to 500,000 products from CSV files with real-time progress tracking
              </p>
            </div>

            <div className="p-6 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors">
              <Database className="w-12 h-12 text-primary mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">Product Management</h3>
              <p className="text-sm text-muted-foreground">
                View, filter, create, update, and delete products with an intuitive interface
              </p>
            </div>

            <div className="p-6 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors">
              <Webhook className="w-12 h-12 text-primary mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">Webhook Integration</h3>
              <p className="text-sm text-muted-foreground">
                Configure webhooks to sync data with external systems automatically
              </p>
            </div>
          </div>

          <div className="mt-16 p-8 rounded-lg bg-card border border-border animate-in fade-in duration-700 delay-500">
            <h3 className="text-2xl font-semibold mb-6">Key Features</h3>
            <div className="grid md:grid-cols-2 gap-4 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Case-Insensitive SKU Matching</p>
                  <p className="text-sm text-muted-foreground">Automatic duplicate detection and overwrite</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Real-Time Progress</p>
                  <p className="text-sm text-muted-foreground">Live updates during file processing</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Advanced Filtering</p>
                  <p className="text-sm text-muted-foreground">Search by SKU, name, description, or status</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Scalable Architecture</p>
                  <p className="text-sm text-muted-foreground">Optimized for large datasets</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
