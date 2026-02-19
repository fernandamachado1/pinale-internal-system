import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useSales, useCreateSale, useProducts } from "@/hooks/use-erp";
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
import { ShoppingCart, Plus, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Sales() {
  const { data: sales, isLoading } = useSales();
  const { data: products } = useProducts();
  const createMutation = useCreateSale();
  const [isOpen, setIsOpen] = useState(false);
  
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("Cartão de Crédito");

  const selectedProduct = products?.find(p => String(p.id) === productId);
  const totalPrice = selectedProduct 
    ? (Number(selectedProduct.price) * Number(quantity)).toFixed(2)
    : "0.00";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return;

    createMutation.mutate({
      productId: parseInt(productId),
      quantitySold: parseInt(quantity),
      paymentMethod,
      totalPrice: totalPrice
    }, {
      onSuccess: () => {
        setIsOpen(false);
        setProductId("");
        setQuantity("1");
        setPaymentMethod("Cartão de Crédito");
      }
    });
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-primary" />
            Vendas
          </h1>
          <p className="text-muted-foreground mt-1">Registre saídas de produtos e faturamento.</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
              <Plus className="w-4 h-4 mr-2" />
              Nova Venda
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Venda</DialogTitle>
              <DialogDescription>
                Isso irá reduzir o estoque do produto.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} (R$ {Number(p.price).toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input 
                      type="number" 
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pagamento</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                        <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                        <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="Boleto">Boleto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-primary/5 rounded-lg p-4 text-center">
                  <span className="text-sm text-muted-foreground uppercase tracking-wider block mb-1">Total da Venda</span>
                  <span className="text-3xl font-bold text-primary">R$ {totalPrice}</span>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Processando..." : "Confirmar Venda"}
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
              <TableHead>Qtd.</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales?.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/50 transition-colors">
                <TableCell className="font-medium text-muted-foreground">#{item.id}</TableCell>
                <TableCell className="font-medium">{item.product.name}</TableCell>
                <TableCell>{item.quantitySold}</TableCell>
                <TableCell>{item.paymentMethod}</TableCell>
                <TableCell className="text-right font-medium">
                  R$ {Number(item.totalPrice).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2 text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(item.createdAt || ""), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!sales?.length && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhuma venda registrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Layout>
  );
}
