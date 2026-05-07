import { useEffect, useMemo, useState } from "react";
import type { SaleListItem } from "@shared/schema";
import { Layout } from "@/components/Layout";
import { useCreateSale, useDeleteSale, useProducedProductStocks, useProducts, useSale, useSales, useUpdateSale } from "@/hooks/use-erp";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShoppingCart, Plus, Trash2, Pencil } from "lucide-react";
import { brl, formatDateTimeBR } from "@/lib/format";
import { useAuthz } from "@/hooks/use-authz";
import { fromPtBrDecimal, toPtBrDecimal } from "@/lib/ptbr-number";

type SaleDiscountType = "PERCENT" | "AMOUNT";
type SaleItem = { productId: string; qty: string; discountType: SaleDiscountType; discountValue: string };

const PAYMENT_METHODS = ["PIX", "DINHEIRO", "DEBITO", "CREDITO", "BOLETO"] as const;

function discountedUnitPrice(price: string | number, discountType: SaleDiscountType, discountValue?: string | number | null): number {
  const listPrice = Number(price ?? 0);
  const value = Math.max(0, Number(discountValue ?? 0));
  if (discountType === "AMOUNT") {
    return Math.max(0, listPrice - Math.min(listPrice, value));
  }
  const discount = Math.min(100, value);
  return listPrice * (1 - discount / 100);
}

function localDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyItem(): SaleItem {
  return { productId: "", qty: "1", discountType: "PERCENT", discountValue: "0" };
}

export default function Sales() {
  const { data: sales, isLoading: isSalesLoading, error: salesError, refetch: refetchSales } = useSales();
  const { data: products, error: productsError } = useProducts();
  const { data: producedStocks, error: stocksError } = useProducedProductStocks();
  const createMutation = useCreateSale();
  const updateMutation = useUpdateSale();
  const deleteMutation = useDeleteSale();
  const { canWrite } = useAuthz();

  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<SaleItem[]>([emptyItem()]);
  const [saleToDelete, setSaleToDelete] = useState<SaleListItem | null>(null);
  const [deletingSaleId, setDeletingSaleId] = useState<number | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [installments, setInstallments] = useState("1");
  const [salesChannel, setSalesChannel] = useState<"ONLINE" | "PHYSICAL">("ONLINE");
  const [description, setDescription] = useState("");
  const [saleDate, setSaleDate] = useState(() => localDateInputValue(new Date()));

  const { data: editingSaleData } = useSale(editingSaleId);

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
        return acc + discountedUnitPrice(product.price, item.discountType, item.discountValue) * Number(item.qty || "0");
      }, 0),
    [items, productById],
  );

  const isValid = useMemo(
    () =>
      items.length > 0 &&
      (paymentMethod !== "CREDITO" || (Number(installments) >= 1 && Number.isInteger(Number(installments)))) &&
      items.every((item) => {
        const product = productById.get(item.productId);
        if (!product) return false;
        const qty = Number(item.qty);
        if (!qty || qty <= 0) return false;
        const discount = Number(item.discountValue);
        if (Number.isNaN(discount) || discount < 0) return false;
        if (item.discountType === "PERCENT" && discount > 100) return false;
        if (item.discountType === "AMOUNT" && discount > Number(product.price)) return false;
        return qty <= (stockByProductId.get(product.id) ?? 0);
      }),
    [items, productById, stockByProductId, paymentMethod, installments],
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
    setInstallments("1");
    setSalesChannel("ONLINE");
    setDescription("");
    setSaleDate(localDateInputValue(new Date()));
    setEditingSaleId(null);
  };

  const openEditSaleDialog = (saleId: number) => {
    if (!canWrite) return;
    setEditingSaleId(saleId);
    setIsOpen(true);
  };

  const openCreateSaleDialog = () => {
    if (!canWrite) return;
    setEditingSaleId(null);
    setIsOpen(true);
  };

  // Hydrate form when editing sale loads
  useEffect(() => {
    if (!editingSaleId) return;
    if (!editingSaleData) return;
    const sale = editingSaleData.sale as any;
    const saleItems = (editingSaleData.items as any[]) ?? [];
    setPaymentMethod(String(sale.paymentMethod ?? "PIX"));
    setInstallments(String(sale.installments ?? "1"));
    setSalesChannel((sale.salesChannel ?? "ONLINE") as "ONLINE" | "PHYSICAL");
    setDescription(String(sale.description ?? ""));
    const soldAt = sale.soldAt ? new Date(sale.soldAt) : new Date();
    setSaleDate(localDateInputValue(soldAt));
    setItems(
      saleItems.map((entry) => {
        return {
          productId: String(entry.productId ?? ""),
          qty: String(entry.qty ?? "1"),
          discountType: (entry.discountType ?? "PERCENT") as SaleDiscountType,
          discountValue: String(entry.discountValue ?? 0),
        };
      }),
    );
  }, [editingSaleId, editingSaleData]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    const soldAtIso = saleDate
      ? (() => {
          const [year, month, day] = saleDate.split("-").map(Number);
          return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
        })()
      : null;

    const payload = {
      paymentMethod,
      installments: paymentMethod === "CREDITO" ? Number(installments) : null,
      description: description.trim() || null,
      salesChannel,
      soldAt: soldAtIso,
      items: items.map((item) => ({
        productId: Number(item.productId),
        qty: Number(item.qty),
        discountType: item.discountType,
        discountValue: Number(item.discountValue),
      })),
    };

    if (editingSaleId) {
      updateMutation.mutate({ id: editingSaleId, data: payload }, { onSuccess: handleClose });
      return;
    }

    createMutation.mutate(payload, { onSuccess: handleClose });
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-primary" /> Vendas
        </h1>

        <ResponsiveDialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : handleClose())}>
          <ResponsiveDialogTrigger asChild>
            <Button disabled={!canWrite || createMutation.isPending || updateMutation.isPending} onClick={openCreateSaleDialog}>
              <Plus className="w-4 h-4 mr-2" /> Nova Venda
            </Button>
          </ResponsiveDialogTrigger>
          <ResponsiveDialogContent className="max-w-lg">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">
                {editingSaleId ? `Editar Venda #${editingSaleId}` : "Registrar Venda"}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="text-sm text-foreground/75">
                {editingSaleId ? "Ajuste itens, descontos e dados da venda." : "Adicione um ou mais produtos à venda."}
              </ResponsiveDialogDescription>
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
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => {
                    setPaymentMethod(value);
                    if (value !== "CREDITO") {
                      setInstallments("1");
                    }
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl border-border bg-card px-4"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === "CREDITO" ? (
                <div className="space-y-2">
                  <Label htmlFor="sale-installments">Número de parcelas</Label>
                  <Input
                    id="sale-installments"
                    inputMode="numeric"
                    type="number"
                    min={1}
                    max={24}
                    step={1}
                    value={installments}
                    onChange={(event) => setInstallments(event.target.value)}
                    className="h-11 rounded-xl border-border bg-card px-4"
                  />
                </div>
              ) : null}

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

              <div className="space-y-2">
                <Label htmlFor="sale-description">Descrição (opcional)</Label>
                <Textarea
                  id="sale-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={500}
                  placeholder="Ex.: Cliente pediu embalagem para presente"
                  className="rounded-xl border-border bg-card px-4 py-3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sale-date">Data da venda</Label>
                <Input
                  id="sale-date"
                  type="date"
                  value={saleDate}
                  onChange={(event) => setSaleDate(event.target.value)}
                  className="h-11 rounded-xl border-border bg-card px-4"
                />
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
                  const discountValue = Number(item.discountValue ?? "0");
                  const hasDiscount = Boolean(product) && discountValue > 0;
                  const unitPrice = product ? discountedUnitPrice(product.price, item.discountType, item.discountValue) : 0;

                  return (
                    <div key={index} className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                      <div className="grid gap-3">
                        <div className="space-y-2">
                          <Label className="ml-1 text-xs font-semibold text-muted-foreground">Produto</Label>
                          <Select
                            value={item.productId}
                            onValueChange={(v) => {
                              const nextProduct = productById.get(v);
                              updateItem(index, {
                                productId: v,
                                qty: "1",
                                discountType: "PERCENT",
                                discountValue: String(nextProduct?.discountPercent ?? "0"),
                              });
                            }}
                          >
                            <SelectTrigger className="h-11 w-full rounded-xl border-border bg-card px-4">
                              <SelectValue placeholder="Produto" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeProducts.map((p) => (
                                <SelectItem
                                  key={p.id}
                                  value={String(p.id)}
                                  disabled={(stockByProductId.get(p.id) ?? 0) <= 0 || selectedInOtherRows.has(String(p.id))}
                                >
                                  {p.name} — {brl(discountedUnitPrice(p.price, "PERCENT", p.discountPercent))}
                                  {Number(p.discountPercent ?? 0) > 0 ? ` (de ${brl(Number(p.price))})` : ""}
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
                          {product && (
                            <p className="text-xs text-muted-foreground">
                              Unitário: <span className="font-semibold text-foreground">{brl(unitPrice)}</span>
                              {hasDiscount ? (
                                <>
                                  {" "}
                                  (<span className="text-muted-foreground">
                                    de {brl(Number(product.price))}, {item.discountType === "AMOUNT" ? brl(discountValue) : `${toPtBrDecimal(item.discountValue)}%`} off
                                  </span>)
                                </>
                              ) : null}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-[minmax(0,1fr)_96px_auto] items-end gap-3">
                          <div className="space-y-2">
                            <Label className="ml-1 text-xs font-semibold text-muted-foreground">Desconto</Label>
                            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                              <Select
                                value={item.discountType}
                                onValueChange={(value) => {
                                  const nextType = value as SaleDiscountType;
                                  const nextProduct = productById.get(item.productId);
                                  const nextValue =
                                    nextType === "PERCENT"
                                      ? String(Math.min(100, Number(item.discountValue || nextProduct?.discountPercent || 0)))
                                      : String(Math.min(Number(nextProduct?.price ?? 0), Number(item.discountValue || 0)));
                                  updateItem(index, { discountType: nextType, discountValue: nextValue });
                                }}
                              >
                                <SelectTrigger className="h-11 rounded-xl border-border bg-card px-3">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PERCENT">%</SelectItem>
                                  <SelectItem value="AMOUNT">R$</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                inputMode="decimal"
                                value={product ? toPtBrDecimal(item.discountValue) : ""}
                                onChange={(e) => updateItem(index, { discountValue: fromPtBrDecimal(e.target.value, 2) })}
                                placeholder="0,00"
                                className="h-11 rounded-xl border-border bg-card px-3 text-right font-semibold"
                                title={`Desconto do item (${item.discountType === "AMOUNT" ? "valor" : "%"})`}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="ml-1 text-xs font-semibold text-muted-foreground">Qtd</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => updateItem(index, { qty: e.target.value })}
                              className="h-11 rounded-xl border-border bg-card px-3"
                            />
                          </div>

                          <div className="flex justify-end pb-1">
                            {items.length > 1 && (
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
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
                <Button type="submit" disabled={!canWrite || createMutation.isPending || updateMutation.isPending || !isValid || Boolean(productsError) || Boolean(stocksError)}>
                  {createMutation.isPending || updateMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                  ) : editingSaleId ? "Atualizar" : "Salvar"}
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
              <TableHead>Descrição</TableHead>
              <TableHead>Data da venda</TableHead>
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
                <TableCell>{item.sale.description || "—"}</TableCell>
                <TableCell>{formatDateTimeBR(item.sale.soldAt ?? item.sale.createdAt)}</TableCell>
                <TableCell className="text-right">
                  {canWrite ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex items-center justify-end gap-1"
                        disabled={deleteMutation.isPending || updateMutation.isPending}
                        onClick={() => openEditSaleDialog(item.sale.id)}
                      >
                        <Pencil className="h-4 w-4" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex items-center justify-end gap-1"
                        disabled={deleteMutation.isPending}
                        onClick={() => setSaleToDelete(item)}
                      >
                        {deleteMutation.isPending && deletingSaleId === item.sale.id ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Excluindo...</>
                        ) : (
                          <><Trash2 className="h-4 w-4" /> Excluir</>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
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
            <Button onClick={() => setIsOpen(true)} disabled={!canWrite}>
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
                setDeletingSaleId(saleToDelete.sale.id);
                deleteMutation.mutate(saleToDelete.sale.id, {
                  onSuccess: () => setSaleToDelete(null),
                  onSettled: () => setDeletingSaleId(null),
                });
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Excluindo...</>
              ) : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>
  );
}
