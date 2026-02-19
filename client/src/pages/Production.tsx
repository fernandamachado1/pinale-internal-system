import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useProductions, useCreateProduction, useProducts } from "@/hooks/use-erp";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Factory, Plus, Calendar, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function Production() {
  const { data: productions, isLoading } = useProductions();
  const { data: products } = useProducts();
  const createMutation = useCreateProduction();
  const [isOpen, setIsOpen] = useState(false);
  
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return;

    createMutation.mutate({
      productId: parseInt(productId),
      quantityProduced: parseInt(quantity)
    }, {
      onSuccess: () => {
        setIsOpen(false);
        setProductId("");
        setQuantity("1");
      }
    });
  };

  // Find selected product to show required materials preview
  const selectedProduct = products?.find(p => String(p.id) === productId);

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Factory className="w-8 h-8 text-primary" />
            Ordens de Produção
          </h1>
          <p className="text-muted-foreground mt-1">Registre a fabricação de produtos e baixa de insumos.</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
              <Plus className="w-4 h-4 mr-2" />
              Nova Produção
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Produção</DialogTitle>
              <DialogDescription>
                Isso irá aumentar o estoque do produto e reduzir os insumos conforme a ficha técnica.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto fabricado..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Quantidade Produzida</Label>
                  <Input 
                    type="number" 
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>

                {selectedProduct && selectedProduct.technicalSpecs.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm border border-border/50">
                    <p className="font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      Consumo Estimado:
                    </p>
                    <ul className="space-y-1 text-muted-foreground">
                      {selectedProduct.technicalSpecs.map(spec => (
                        <li key={spec.id} className="flex justify-between">
                          <span>{spec.material.name}</span>
                          <span className="font-mono">
                            {(Number(spec.quantityRequired) * Number(quantity)).toFixed(2)} {spec.material.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Processando..." : "Confirmar Produção"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Qtd. Produzida</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productions?.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/50 transition-colors">
                <TableCell className="font-medium text-muted-foreground">#{item.id}</TableCell>
                <TableCell className="font-medium">{item.product.name}</TableCell>
                <TableCell className="text-right font-mono">{item.quantityProduced}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(item.createdAt || ""), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                    Concluído
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {!productions?.length && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhuma produção registrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Layout>
  );
}
