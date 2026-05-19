import { Layout } from "@/components/Layout";
import type { MovementWithDetails } from "@shared/schema";
import { useInventoryMovements } from "@/hooks/use-erp";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeftRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTimeBR } from "@/lib/format";
import { useLocation } from "wouter";
import { useMemo, useState } from "react";

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
  const [visibleCount, setVisibleCount] = useState(100);

  const visibleMovements = useMemo(() => movements?.slice(0, visibleCount) ?? [], [movements, visibleCount]);
  const hasMore = (movements?.length ?? 0) > visibleCount;

  const getReasonLabel = (movement: MovementWithDetails) => {
    const subtype = typeof movement?.metadata === "object" && movement?.metadata
      ? (movement.metadata as { subtype?: string }).subtype
      : undefined;
    if (movement.reason === "ADJUSTMENT" && subtype === "INITIAL_ENTRY") return "Entrada inicial";
    return reasonLabels[movement.reason];
  };

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
        <div className="space-y-4">
          <div className="space-y-3 md:hidden">
            {visibleMovements.map((movement) => (
              <Card key={movement.id} className="border-border/70 bg-card/90 shadow-none">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs text-muted-foreground">#{movement.id}</p>
                      <p className="text-sm font-semibold text-foreground">
                        {entityLabels[movement.entityType]}
                        {movement.product ? ` • ${movement.product.name}` : ""}
                        {movement.material ? ` • ${movement.material.name}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Qtd</p>
                      <p className="text-sm font-semibold text-foreground">{movement.qty}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-muted/40 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Direção</p>
                      <p className="font-medium text-foreground">{directionLabels[movement.direction]}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Razão</p>
                      <p className="font-medium text-foreground">{getReasonLabel(movement)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 px-3 py-2 col-span-2">
                      <p className="text-[11px] text-muted-foreground">Referência</p>
                      <p className="font-medium text-foreground">
                        {referenceTypeLabels[movement.referenceType]}
                        {movement.referenceId ? ` #${movement.referenceId}` : ""}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/40 px-3 py-2 col-span-2">
                      <p className="text-[11px] text-muted-foreground">Data</p>
                      <p className="font-medium text-foreground">{formatDateTimeBR(movement.createdAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden md:block">
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
                {visibleMovements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>#{movement.id}</TableCell>
                    <TableCell>
                      {entityLabels[movement.entityType]}
                      {movement.product ? ` - ${movement.product.name}` : ""}
                      {movement.material ? ` - ${movement.material.name}` : ""}
                    </TableCell>
                    <TableCell>{directionLabels[movement.direction]}</TableCell>
                    <TableCell>{movement.qty}</TableCell>
                    <TableCell>{getReasonLabel(movement)}</TableCell>
                    <TableCell>
                      {referenceTypeLabels[movement.referenceType]}
                      {movement.referenceId ? ` #${movement.referenceId}` : ""}
                    </TableCell>
                    <TableCell>{formatDateTimeBR(movement.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {hasMore ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setVisibleCount((current) => current + 100)}>
                Carregar mais {Math.min(100, (movements?.length ?? 0) - visibleCount)}
              </Button>
            </div>
          ) : null}
        </div>
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
