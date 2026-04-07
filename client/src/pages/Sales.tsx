import { useMemo, useState } from "react";
import type { SaleListItem } from "@shared/schema";
import { Layout } from "@/components/Layout";
import { useCreateSale, useDeleteSale, useProducedProductStocks, useProducts, useSales } from "@/hooks/use-erp";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogFooter, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogTrigger } from "@/components/ui/responsive-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Plus, Trash2 } from "lucide-react";
import { brl, formatDateTimeBR } from "@/lib/format";

type SaleItem = { productId: string; qty: string };

const PAYMENT_METHODS = ["PIX", "DINHEIRO", "DEBITO", "CREDITO", "BOLETO"] as const;

function emptyItem(): SaleItem {
  return { productId: "", qty: "1" };
}

export default function Sales() {
  const { data: sales, isLoading: isSalesLoading, error: salesError, refetch: refetchSales } = useSales();
  const { data: products, error: productsError } = useProducts();
  const { data: producedStocks, error: stocksError } = useProducedProductStocks();
  const createMutation = useCreateSale();
  const deleteMutation = useDeleteSale();

  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<SaleItem[]>([emptyItem()]);
  const [saleToDelete, setSaleToDelete] = useState<SaleListItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [salesChannel, setSalesChannel] = useState<"ONLINE" | "PHYSICAL">("ONLINE");

  const activeProducts = useMemo(() => products?.filter((p) => p.isActive === 1) ?? [], [products]);

  const stockByProductId = useMemo(
    () => new Map(producedStocks?.map((s) => [s.productId, s.stockQty]) ?? []),
    [producedStocks],
  );

  const productById = useMemo(
    () => new Map(activeProducts.map((p) => [String(p.id), p])),
    [activeProducts],
  );

  const total = useMemo(
    () =>
      items.reduce((acc, item) => {
        const product = productById.get(item.productId);
        if (!product) return acc;
        return acc + Number(product.price) * Number(item.qty || "0");
      }, 0),
    [items, productById],
  );

  const isValid = useMemo(
    () =>
      items.length > 0 &&
      items.every((item) => {
        const product = productById.get(item.productId);
        if (!product) return false;
        const qty = Number(item.qty);
        if (!qty || qty <= 0) return false;
        return qty <= (stockByProductId.get(product.id) ?? 0);
      }),
    [items, productById, stockByProductId],
  );

  const updateItem = (index: number, patch: Partial<SaleItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const handleClose = () => {
    setIsOpen(false);
    setItems([emptyItem()]);
    setPaymentMethod("PIX");
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;

    createMutation.mutate(
      {
        paymentMethod,
        salesChannel,
        items: items.map((item) => ({ productId: Number(item.productId), qty: Number(item.qty) })),
      },
      { onSuccess: handleClose },
    );
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-primary" /> Vendas
        </h1>

        <ResponsiveDialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : handleClose())}>
          <ResponsiveDialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Nova Venda
            </Button>
          </ResponsiveDialogTrigger>
          <ResponsiveDialogContent className="max-w-lg">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Registrar Venda</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>Adicione um ou mais produtos à venda.</ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            {(productsError || stocksError) ? (
              <Alert variant="destructive">
                <AlertTitle>Não foi possível carregar produtos/estoque</AlertTitle>
                <AlertDescription>Verifique o servidor/banco e tente novamente.</AlertDescription>
              </Alert>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Canal de venda</Label>
                <RadioGroup value={salesChannel} onValueChange={(value) => setSalesChannel(value as "ONLINE" | "PHYSICAL")} className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="ONLINE" id="sales-channel-online" />
                    <Label htmlFor="sales-channel-online">Online</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="PHYSICAL" id="sales-channel-physical" />
                    <Label htmlFor="sales-channel-physical">Físico</Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Itens</Label>
                {items.map((item, index) => {
                  const product = productById.get(item.productId);
                  const stock = product ? (stockByProductId.get(product.id) ?? 0) : 0;
                  const qty = Number(item.qty || "0");
                  const overStock = product && qty > stock;
                  const selectedInOtherRows = new Set(items.filter((_, i) => i !== index).map((row) => row.productId).filter(Boolean));

                  return (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <Select value={item.productId} onValueChange={(v) => updateItem(index, { productId: v, qty: "1" })}>
                          <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
                          <SelectContent>
                            {activeProducts.map((p) => (
                              <SelectItem
                                key={p.id}
                                value={String(p.id)}
                                disabled={(stockByProductId.get(p.id) ?? 0) <= 0 || selectedInOtherRows.has(String(p.id))}
                              >
                                {p.name} — {brl(Number(p.price))}
                                {(stockByProductId.get(p.id) ?? 0) <= 0 ? " (sem estoque)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {product && (
                          <p className={`text-xs ${overStock ? "text-destructive" : "text-muted-foreground"}`}>
                            Estoque disponível: {stock} un{overStock ? " — quantidade excede o estoque" : ""}
                          </p>
                        )}
                      </div>
                      <Input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateItem(index, { qty: e.target.value })}
                        className="w-20"
                      />
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  );
                })}

                <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
                  <Plus className="w-3 h-3 mr-1" /> Adicionar produto
                </Button>
              </div>

              <Separator />

              <div className="text-right text-lg font-semibold">
                Total: {brl(total)}
              </div>

              <ResponsiveDialogFooter className="justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || !isValid || Boolean(productsError) || Boolean(stocksError)}>
                  Salvar
                </Button>
              </ResponsiveDialogFooter>
            </form>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </div>

      {salesError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Não foi possível carregar as vendas</AlertTitle>
          <AlertDescription>
            Verifique se o servidor e o banco estão rodando e tente novamente.
            <div className="mt-3">
              <Button variant="outline" onClick={() => refetchSales()}>
                Tentar novamente
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {isSalesLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : sales?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Venda</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Qtd</TableHead>
              <TableHead>Unitário</TableHead>
              <TableHead>Total Item</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((item) => (
              <TableRow key={item.id}>
                <TableCell>#{item.saleId}</TableCell>
                <TableCell>{item.product.name}</TableCell>
                <TableCell>{item.sale.salesChannel === "PHYSICAL" ? "Físico" : "Online"}</TableCell>
               <TableCell>{item.qty}</TableCell>
                <TableCell>{brl(Number(item.unitPrice))}</TableCell>
                <TableCell>{brl(Number(item.totalPrice))}</TableCell>
                <TableCell>{item.sale.paymentMethod}</TableCell>
                <TableCell>{formatDateTimeBR(item.sale.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex items-center justify-end gap-1"
                    disabled={deleteMutation.isPending}
                    onClick={() => setSaleToDelete(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma venda registrada</CardTitle>
            <CardDescription>Registre sua primeira venda para ver o histórico e movimentações.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nova Venda
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={saleToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSaleToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda #{saleToDelete?.sale.id ?? ""}</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja excluir esta venda e devolver as unidades ao estoque produzido?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSaleToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!saleToDelete) return;
                deleteMutation.mutate(saleToDelete.sale.id, {
                  onSuccess: () => setSaleToDelete(null),
                });
              }}
              disabled={deleteMutation.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>
  );
}
