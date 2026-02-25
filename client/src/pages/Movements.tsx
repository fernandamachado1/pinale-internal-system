import { Layout } from "@/components/Layout";
import { useInventoryMovements } from "@/hooks/use-erp";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeftRight } from "lucide-react";

const entityLabels: Record<"PRODUCT" | "MATERIAL" | "MATERIAL_GROUP", string> = {
  PRODUCT: "Produto",
  MATERIAL: "Material",
  MATERIAL_GROUP: "Grupo de material",
};
const directionLabels: Record<"IN" | "OUT", string> = {
  IN: "Entrada",
  OUT: "Saída",
};
const reasonLabels: Record<"PRODUCTION_CONSUMPTION" | "PRODUCTION_OUTPUT" | "SALE" | "PURCHASE" | "ADJUSTMENT", string> = {
  PRODUCTION_CONSUMPTION: "Consumo de produção",
  PRODUCTION_OUTPUT: "Saída da produção",
  SALE: "Venda",
  PURCHASE: "Compra",
  ADJUSTMENT: "Ajuste",
};
const referenceTypeLabels: Record<"OP" | "SALE" | "MANUAL", string> = {
  OP: "Ordem de produção",
  SALE: "Venda",
  MANUAL: "Manual",
};
const groupLabels: Record<"LEATHER" | "HARDWARE" | "ADHESIVE" | "THREAD" | "OTHER", string> = {
  LEATHER: "Couro",
  HARDWARE: "Ferragens",
  ADHESIVE: "Adesivos",
  THREAD: "Linha",
  OTHER: "Outros",
};

export default function Movements() {
  const { data: movements } = useInventoryMovements();

  return (
    <Layout>
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ArrowLeftRight className="w-8 h-8 text-primary" />
          Ledger de Movimentações
        </h1>
        <p className="text-muted-foreground">Histórico imutável (append-only).</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Entidade</TableHead>
            <TableHead>Direção</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Razão</TableHead>
            <TableHead>Referência</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements?.map((movement) => (
            <TableRow key={movement.id}>
              <TableCell>#{movement.id}</TableCell>
              <TableCell>
                {entityLabels[movement.entityType]}
                {movement.product ? ` - ${movement.product.name}` : ""}
                {movement.material ? ` - ${movement.material.name}` : ""}
                {movement.group ? ` - ${groupLabels[movement.group]}` : ""}
              </TableCell>
              <TableCell>{directionLabels[movement.direction]}</TableCell>
              <TableCell>{movement.qty}</TableCell>
              <TableCell>{reasonLabels[movement.reason]}</TableCell>
              <TableCell>
                {referenceTypeLabels[movement.referenceType]}
                {movement.referenceId ? ` #${movement.referenceId}` : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Layout>
  );
}
