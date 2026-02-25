import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { useInventoryMovements, useMaterials, useProductionOrders, useSales } from "@/hooks/use-erp";
import { AlertCircle, ArrowUpRight, Factory, ShoppingCart } from "lucide-react";

export default function Dashboard() {
  const { data: materials } = useMaterials();
  const { data: orders } = useProductionOrders();
  const { data: sales } = useSales();
  const { data: movements } = useInventoryMovements();

  const controlledBelowZero = materials?.filter((m) => m.policy === "STOCK_CONTROLLED" && Number(m.stockQty ?? 0) <= 0).length || 0;
  const doneOrders = orders?.filter((o) => o.status === "DONE").length || 0;
  const totalSales = sales?.reduce((acc, item) => acc + Number(item.totalPrice), 0) || 0;

  return (
    <Layout>
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-3xl font-bold">Visão Geral</h1>
        <p className="text-muted-foreground">Resumo operacional do Ateliê.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Faturamento" value={`R$ ${totalSales.toFixed(2)}`} icon={<ShoppingCart className="w-4 h-4" />} description="Total vendido" />
        <StatCard title="OPs Concluídas" value={doneOrders} icon={<Factory className="w-4 h-4" />} description="Status DONE" />
        <StatCard title="Estoque Crítico" value={controlledBelowZero} icon={<AlertCircle className="w-4 h-4" />} description="Materiais controlados com estoque zerado ou negativo" />
        <StatCard title="Movimentações" value={movements?.length || 0} icon={<ArrowUpRight className="w-4 h-4" />} description="Ledger append-only" />
      </div>
    </Layout>
  );
}
