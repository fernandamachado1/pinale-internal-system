import { Layout } from "@/components/Layout";
import { useProducedProductStocks } from "@/hooks/use-erp";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Boxes } from "lucide-react";
import { brl, formatDateTimeBR } from "@/lib/format";

export default function ProducedStock() {
  const { data: stocks, isLoading, error, refetch } = useProducedProductStocks();

  return (
    <Layout>
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Boxes className="w-8 h-8 text-primary" />
          Estoque Produzido
        </h1>
        <p className="text-muted-foreground">Saldo operacional disponível para venda por produto.</p>
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Não foi possível carregar o estoque</AlertTitle>
          <AlertDescription>
            Verifique se o servidor e o banco estão rodando e tente novamente.
            <div className="mt-3">
              <Button variant="outline" onClick={() => refetch()}>
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
      ) : stocks?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Atualizado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stocks.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.product.name}</TableCell>
                <TableCell>{brl(Number(item.product.price))}</TableCell>
                <TableCell className="text-right">{item.stockQty}</TableCell>
                <TableCell>{formatDateTimeBR(item.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum saldo disponível</CardTitle>
            <CardDescription>Conclua uma ordem de produção para gerar estoque pronto para venda.</CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      )}
    </Layout>
  );
}
