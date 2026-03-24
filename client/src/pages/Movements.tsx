import { Layout } from "@/components/Layout";
import { useInventoryMovements } from "@/hooks/use-erp";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeftRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTimeBR } from "@/lib/format";
import { useLocation } from "wouter";

const entityLabels: Record<"PRODUCT" | "MATERIAL", string> = {
  PRODUCT: "Produto",
  MATERIAL: "Material",
};
const directionLabels: Record<"IN" | "OUT", string> = {
  IN: "Entrada",
  OUT: "Saída",
};
const reasonLabels: Record<"PRODUCTION_CONSUMPTION" | "PRODUCTION_OUTPUT" | "SALE" | "PURCHASE" | "ADJUSTMENT", string> = {
  PRODUCTION_CONSUMPTION: "Consumo de produção",
  PRODUCTION_OUTPUT: "Entrada da produção",
  SALE: "Venda",
  PURCHASE: "Compra",
  ADJUSTMENT: "Ajuste",
};
const referenceTypeLabels: Record<"OP" | "SALE" | "MANUAL", string> = {
  OP: "Ordem de produção",
  SALE: "Venda",
  MANUAL: "Manual",
};

export default function Movements() {
  const { data: movements, isLoading, error, refetch } = useInventoryMovements();
  const [, setLocation] = useLocation();

  return (
    <Layout>
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ArrowLeftRight className="w-8 h-8 text-primary" />
          Ledger de Movimentações
        </h1>
        <p className="text-muted-foreground">Histórico imutável (append-only).</p>
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Não foi possível carregar as movimentações</AlertTitle>
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
      ) : movements?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Direção</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Razão</TableHead>
              <TableHead>Referência</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>#{movement.id}</TableCell>
                <TableCell>
                  {entityLabels[movement.entityType]}
                  {movement.product ? ` - ${movement.product.name}` : ""}
                  {movement.material ? ` - ${movement.material.name}` : ""}
                </TableCell>
                <TableCell>{directionLabels[movement.direction]}</TableCell>
                <TableCell>{movement.qty}</TableCell>
                <TableCell>{reasonLabels[movement.reason]}</TableCell>
                <TableCell>
                  {referenceTypeLabels[movement.referenceType]}
                  {movement.referenceId ? ` #${movement.referenceId}` : ""}
                </TableCell>
                <TableCell>{formatDateTimeBR(movement.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma movimentação registrada</CardTitle>
            <CardDescription>As movimentações aparecem automaticamente com produção, venda ou ajustes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/production")}>Criar ordem de produção</Button>
          </CardContent>
        </Card>
      )}
    </Layout>
  );
}
