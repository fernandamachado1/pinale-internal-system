import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { useCreateSale, useProducts, useSales } from "@/hooks/use-erp";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Plus } from "lucide-react";

export default function Sales() {
  const { data: sales } = useSales();
  const { data: products } = useProducts();
  const createMutation = useCreateSale();

  const [isOpen, setIsOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("PIX");

  const activeProducts = useMemo(() => products?.filter((product) => product.isActive === 1) ?? [], [products]);

  const selectedProduct = useMemo(
    () => activeProducts.find((product) => String(product.id) === productId),
    [activeProducts, productId],
  );

  const estimated = useMemo(() => {
    if (!selectedProduct) return 0;
    return Number(selectedProduct.price) * Number(qty || "0");
  }, [selectedProduct, qty]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProduct) return;

    createMutation.mutate(
      {
        paymentMethod,
        items: [{ productId: selectedProduct.id, qty: Number(qty) }],
      },
      {
        onSuccess: () => {
          setIsOpen(false);
          setProductId("");
          setQty("1");
          setPaymentMethod("PIX");
        },
      },
    );
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-primary" /> Vendas
        </h1>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Nova Venda
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Venda</DialogTitle>
              <DialogDescription>Venda com snapshot de preço do produto.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {activeProducts.map((product) => (
                      <SelectItem key={product.id} value={String(product.id)}>
                        {product.name} (R$ {Number(product.price).toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["PIX", "DINHEIRO", "DEBITO", "CREDITO", "BOLETO"] as const).map((method) => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>
              </div>

              <div className="text-right text-lg font-semibold">Total estimado: R$ {estimated.toFixed(2)}</div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || !selectedProduct}>Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Venda</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead>Qtd</TableHead>
            <TableHead>Unitário</TableHead>
            <TableHead>Total Item</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales?.map((item) => (
            <TableRow key={item.id}>
              <TableCell>#{item.saleId}</TableCell>
              <TableCell>{item.product.name}</TableCell>
              <TableCell>{item.qty}</TableCell>
              <TableCell>R$ {Number(item.unitPrice).toFixed(2)}</TableCell>
              <TableCell>R$ {Number(item.totalPrice).toFixed(2)}</TableCell>
              <TableCell>{item.sale.paymentMethod}</TableCell>
              <TableCell>{new Date(item.sale.createdAt).toLocaleString("pt-BR")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Layout>
  );
}
