import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { 
  Package, 
  Factory, 
  ShoppingCart, 
  AlertCircle, 
  TrendingUp, 
  ArrowUpRight 
} from "lucide-react";
import { useInventoryMovements, useMaterials, useProductions, useSales } from "@/hooks/use-erp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Dashboard() {
  const { data: materials } = useMaterials();
  const { data: productions } = useProductions();
  const { data: sales } = useSales();
  const { data: movements } = useInventoryMovements();

  // Metrics calculation
  const lowStockMaterials = materials?.filter(m => Number(m.quantity) < 10).length || 0;
  const totalProductions = productions?.length || 0;
  const totalSales = sales?.reduce((acc, sale) => acc + Number(sale.totalPrice), 0) || 0;
  
  // Prepare chart data (Sales over time)
  const salesData = sales?.reduce((acc: any[], sale) => {
    const date = format(new Date(sale.createdAt || new Date()), "dd/MM", { locale: ptBR });
    const existing = acc.find(item => item.date === date);
    if (existing) {
      existing.amount += Number(sale.totalPrice);
    } else {
      acc.push({ date, amount: Number(sale.totalPrice) });
    }
    return acc;
  }, []).sort((a, b) => a.date.localeCompare(b.date)).slice(-7) || [];

  return (
    <Layout>
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-3xl font-display font-bold text-foreground">Visão Geral</h1>
        <p className="text-muted-foreground">Resumo das operações e indicadores chave.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Vendas Totais" 
          value={`R$ ${totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          icon={<ShoppingCart className="w-4 h-4" />}
          description="Valor total acumulado"
        />
        <StatCard 
          title="Ordens de Produção" 
          value={totalProductions} 
          icon={<Factory className="w-4 h-4" />}
          description="Total de ordens concluídas"
        />
        <StatCard 
          title="Insumos Baixos" 
          value={lowStockMaterials} 
          icon={<AlertCircle className="w-4 h-4" />}
          description="Itens com estoque < 10"
        />
        <StatCard 
          title="Movimentações" 
          value={movements?.length || 0} 
          icon={<ArrowUpRight className="w-4 h-4" />}
          description="Total de entradas e saídas"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-7 mt-8">
        <Card className="col-span-4 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Tendência de Vendas</CardTitle>
            <CardDescription>Receita dos últimos 7 dias</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R$${value}`}
                  />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)'
                    }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Vendas']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorSales)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Produções Recentes</CardTitle>
            <CardDescription>Últimas ordens finalizadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {productions?.slice(0, 5).map((prod) => (
                <div key={prod.id} className="flex items-center">
                  <div className="bg-primary/10 p-2 rounded-full mr-4">
                    <Factory className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium leading-none">{prod.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Qtd: {prod.quantityProduced} unidades
                    </p>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground">
                    {format(new Date(prod.createdAt || new Date()), "dd/MM", { locale: ptBR })}
                  </div>
                </div>
              ))}
              {!productions?.length && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma produção recente.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
