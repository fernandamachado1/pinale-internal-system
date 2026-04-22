import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { useProducts, useProducedProductStockSummary, useProducedProductStocks } from "@/hooks/use-erp";
import { AdjustProducedStockDialog } from "@/components/produced-stock/AdjustProducedStockDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, formatDateTimeBR } from "@/lib/format";
import { useAuthz } from "@/hooks/use-authz";
import { ArrowUpDown, Boxes } from "lucide-react";

type StockRow = {
  productId: number;
  productName: string;
  productPrice: string;
  hasBom: boolean;
  inQty: number;
  outQty: number;
  stockQty: number;
  updatedAt: string | Date | null;
};

export default function ProducedStock() {
  const { data: products, isLoading: isProductsLoading, error: productsError, refetch: refetchProducts } = useProducts();
  const { data: stocks, isLoading: isStocksLoading, error: stocksError, refetch: refetchStocks } = useProducedProductStocks();
  const { data: stockSummary, isLoading: isSummaryLoading, error: summaryError, refetch: refetchSummary } = useProducedProductStockSummary();
  const { canWrite } = useAuthz();
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<{ id: number; name: string; stockQty: number } | null>(null);

  const stockByProductId = useMemo(() => new Map((stocks ?? []).map((item) => [item.productId, item])), [stocks]);
  const summaryByProductId = useMemo(() => new Map((stockSummary ?? []).map((item) => [item.productId, item])), [stockSummary]);
  const rows = useMemo<StockRow[]>(
    () =>
      (products ?? []).map((product) => {
        const stock = stockByProductId.get(product.id);
        const summary = summaryByProductId.get(product.id);
        return {
          productId: product.id,
          productName: product.name,
          productPrice: product.price,
          hasBom: (product.bomItems?.length ?? 0) > 0,
          inQty: Number(summary?.inQty ?? 0),
          outQty: Number(summary?.outQty ?? 0),
          stockQty: Number(stock?.stockQty ?? 0),
          updatedAt: stock?.updatedAt ?? null,
        };
      }),
    [products, stockByProductId, summaryByProductId],
  );

  const hasError = productsError || stocksError || summaryError;
  const isLoading = isProductsLoading || isStocksLoading || isSummaryLoading;

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <Boxes className="h-8 w-8 text-primary" />
          Estoque Produzido
        </h1>
        <p className="text-muted-foreground">Cada produto do catálogo mostra entradas, saídas e saldo final de itens acabados.</p>
      </div>

      {hasError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Não foi possível carregar o estoque produzido</AlertTitle>
          <AlertDescription>
            Verifique se o servidor e o banco estão rodando e tente novamente.
            <div className="mt-3">
              <Button
                variant="outline"
                onClick={() => {
                  refetchProducts();
                  refetchStocks();
                  refetchSummary();
                }}
              >
                Tentar novamente
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Estrutura</TableHead>
              <TableHead className="text-right">Entradas</TableHead>
              <TableHead className="text-right">Saídas</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Atualizado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.productId}>
                <TableCell>{row.productName}</TableCell>
                <TableCell>{brl(Number(row.productPrice))}</TableCell>
                <TableCell>
                  {row.hasBom ? <Badge variant="outline">Com ficha</Badge> : <Badge variant="secondary">Sem ficha</Badge>}
                </TableCell>
                <TableCell className="text-right">{row.inQty}</TableCell>
                <TableCell className="text-right">{row.outQty}</TableCell>
                <TableCell className="text-right font-semibold">{row.stockQty}</TableCell>
                <TableCell>{row.updatedAt ? formatDateTimeBR(row.updatedAt) : "-"}</TableCell>
                <TableCell className="text-right">
                  {canWrite ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9"
                      onClick={() => {
                        setAdjustProduct({ id: row.productId, name: row.productName, stockQty: row.stockQty });
                        setAdjustDialogOpen(true);
                      }}
                      aria-label={`Ajustar estoque de ${row.productName}`}
                      title="Ajustar estoque"
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
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
            <CardTitle>Nenhum produto cadastrado</CardTitle>
            <CardDescription>Cadastre itens no catálogo para controlar o estoque produzido.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => (window.location.href = "/products")}>Ir para Catálogo</Button>
          </CardContent>
        </Card>
      )}

      <AdjustProducedStockDialog
        open={adjustDialogOpen}
        onOpenChange={(open) => {
          setAdjustDialogOpen(open);
          if (!open) setAdjustProduct(null);
        }}
        product={adjustProduct}
      />
    </Layout>
  );
}
