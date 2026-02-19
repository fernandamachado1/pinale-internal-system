import { Layout } from "@/components/Layout";
import { useInventoryMovements } from "@/hooks/use-erp";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { ArrowLeftRight, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function Movements() {
  const { data: movements, isLoading } = useInventoryMovements();

  const getMovementLabel = (type: string) => {
    switch(type) {
      case 'material_in': return 'Entrada Insumo';
      case 'material_out': return 'Saída Insumo';
      case 'product_in': return 'Entrada Produto';
      case 'product_out': return 'Saída Produto';
      case 'adjustment': return 'Ajuste';
      default: return type;
    }
  };

  const isPositive = (val: number) => val > 0;

  return (
    <Layout>
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <ArrowLeftRight className="w-8 h-8 text-primary" />
          Movimentações
        </h1>
        <p className="text-muted-foreground mt-1">Histórico completo de entradas e saídas.</p>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px]">Tipo</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead className="text-right">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements?.map((item) => {
              const qty = Number(item.quantityChange);
              const itemName = item.product?.name || item.material?.name || "Desconhecido";
              const unit = item.material?.unit || "un";
              
              return (
                <TableRow key={item.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {getMovementLabel(item.type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{itemName}</TableCell>
                  <TableCell className="text-right font-mono flex items-center justify-end gap-2">
                    <span className={isPositive(qty) ? "text-green-600" : "text-red-600"}>
                      {qty > 0 ? "+" : ""}{qty} {unit}
                    </span>
                    {qty > 0 ? (
                      <ArrowUpRight className="w-4 h-4 text-green-600" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4 text-red-600" />
                    )}
                  </TableCell>
                  <TableCell>{item.reason}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {format(new Date(item.createdAt || ""), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              );
            })}
            {!movements?.length && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhuma movimentação registrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Layout>
  );
}
