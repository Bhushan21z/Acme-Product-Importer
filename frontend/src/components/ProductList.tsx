import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ProductDialog from "./ProductDialog";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface Product {
  id: number;
  name: string;
  sku: string;
  description: string;
  active: boolean;
}

const ProductList = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const itemsPerPage = 50;

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const filtered = products.filter(product => {
      const search = searchTerm.toLowerCase();
      return (
        product.name?.toLowerCase().includes(search) ||
        product.sku?.toLowerCase().includes(search) ||
        product.description?.toLowerCase().includes(search)
      );
    });
    setFilteredProducts(filtered);
    setCurrentPage(1);
  }, [searchTerm, products]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/products`);
      if (!response.ok) throw new Error("Failed to fetch products");
      
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    // This would call your backend bulk delete endpoint
    toast({
      title: "Feature coming soon",
      description: "Bulk delete endpoint needs to be implemented in backend"
    });
    setShowDeleteAll(false);
  };

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Product Management</CardTitle>
            <CardDescription>
              View and manage your product catalog ({products.length} total products)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchProducts}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteAll(true)}
              disabled={products.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete All
            </Button>
            <Button onClick={() => {
              setSelectedProduct(null);
              setShowProductDialog(true);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by SKU, name, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Loading products...
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No products found matching your search" : "No products available"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {product.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.active ? "default" : "secondary"}>
                        {product.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowProductDialog(true);
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of{" "}
              {filteredProducts.length} products
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={showDeleteAll} onOpenChange={setShowDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Products?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all {products.length} products
              from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProductDialog
        open={showProductDialog}
        onOpenChange={setShowProductDialog}
        product={selectedProduct}
        onSuccess={fetchProducts}
      />
    </Card>
  );
};

export default ProductList;
