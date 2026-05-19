import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  CalendarIcon,
  Factory,
  Banknote,
  PackageOpen,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { useDashboardReport } from "@/hooks/use-erp";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { brl, formatQtyByUom } from "@/lib/format";
import { useLocation } from "wouter";

function getDefaultRange(): DateRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 29);
  return { from, to };
}

function toEndOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function groupChartSeries(
  series: { date: string; producedValue: number; soldValue: number }[],
  from: Date,
  to: Date,
) {
  const spanDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);

  if (spanDays <= 31) {
    return series.map((s) => ({
      ...s,
      label: format(new Date(s.date + "T12:00:00"), "dd/MM", { locale: ptBR }),
    }));
  }

  if (spanDays <= 120) {
    const buckets = new Map<string, { label: string; producedValue: number; soldValue: number }>();
    for (const s of series) {
      const d = new Date(s.date + "T12:00:00");
      d.setDate(d.getDate() - d.getDay());
      const key = format(d, "dd/MM", { locale: ptBR });
      const cur = buckets.get(key) ?? { label: key, producedValue: 0, soldValue: 0 };
      cur.producedValue += s.producedValue;
      cur.soldValue += s.soldValue;
      buckets.set(key, cur);
    }
    return Array.from(buckets.values());
  }

  const buckets = new Map<string, { label: string; producedValue: number; soldValue: number }>();
  for (const s of series) {
    const key = format(new Date(s.date + "T12:00:00"), "MMM/yy", { locale: ptBR });
    const cur = buckets.get(key) ?? { label: key, producedValue: 0, soldValue: 0 };
    cur.producedValue += s.producedValue;
    cur.soldValue += s.soldValue;
    buckets.set(key, cur);
  }
  return Array.from(buckets.values());
}

export default function Dashboard() {
  const [range, setRange] = useState<DateRange>(getDefaultRange);
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();

  const from = range.from;
  const to = range.to ? toEndOfDay(range.to) : range.from ? toEndOfDay(range.from) : undefined;

  const { data: report, isLoading, error, refetch } = useDashboardReport(from, to);

  const chartData = useMemo(() => {
    if (!report?.chartSeries || !from || !to) return [];
    return groupChartSeries(report.chartSeries, from, to);
  }, [report?.chartSeries, from, to]);

  const producedValue = report?.producedValue ?? 0;
  const soldValue = report?.soldValue ?? 0;
  const openOrdersCount = report?.openOrdersCount ?? 0;
  const isEmptyState =
    Boolean(report) &&
    producedValue === 0 &&
    soldValue === 0 &&
    openOrdersCount === 0 &&
    (report?.topSold?.length ?? 0) === 0 &&
    (report?.productStock?.length ?? 0) === 0;

  const rangeLabel = from
    ? to && to !== from
      ? `${format(from, "dd/MM/yyyy")} – ${format(to, "dd/MM/yyyy")}`
      : format(from, "dd/MM/yyyy")
    : "Selecionar período";

  return (
    <Layout>
      <PageHeader
        title="Visão geral"
        description="Indicadores, tendências e alertas do período selecionado."
        actions={
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "gap-2 w-full justify-start sm:min-w-[220px] sm:w-auto",
                  !from && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="w-4 h-4" />
                {rangeLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align={isMobile ? "start" : "end"}>
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) => r && setRange(r)}
                numberOfMonths={isMobile ? 1 : 2}
                locale={ptBR}
                disabled={{ after: new Date() }}
              />
            </PopoverContent>
          </Popover>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar o painel</AlertTitle>
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

      {!isLoading && !error && isEmptyState ? (
        <Card className="border-border/70 bg-card/90 shadow-none">
          <CardHeader>
            <CardTitle>Sem dados para mostrar ainda</CardTitle>
            <CardDescription>
              Cadastre materiais e produtos para começar a produzir e registrar vendas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/materials")}>Cadastrar primeiro material</Button>
          </CardContent>
        </Card>
      ) : null}

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-border/70 bg-card/90 p-6 shadow-none">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Valor Produzido"
            value={brl(producedValue)}
            icon={<Factory className="w-5 h-5" />}
            description="OPs concluídas no período"
            iconClassName="bg-primary/10 text-primary"
          />
          <StatCard
            title="Valor Vendido"
            value={brl(soldValue)}
            icon={<Banknote className="w-5 h-5" />}
            description="Faturamento total líquido"
            iconClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          />
        </div>
      )}

      {/* Chart + Top Vendidos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border border-border/70 bg-card/90 shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Produção vs Vendas</CardTitle>
                <CardDescription>Valor produzido e faturado no período.</CardDescription>
              </div>
              <div className="flex gap-4 text-xs font-medium text-muted-foreground shrink-0">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-chart-1 inline-block" />
                  Produzido
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-chart-3 inline-block" />
                  Vendido
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer
              className="h-[240px] w-full aspect-auto sm:h-[280px]"
              config={{
                producedValue: { label: "Produzido (R$)", color: "hsl(var(--chart-1))" },
                soldValue: { label: "Vendido (R$)", color: "hsl(var(--chart-3))" },
              }}
            >
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={isMobile ? 56 : 72}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                  }
                />
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(v) => brl(Number(v))} />}
                />
                <Bar dataKey="producedValue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="soldValue" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card/90 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Top Produtos Vendidos</CardTitle>
            <CardDescription>Por faturamento no período.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {!report?.topSold?.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
            ) : (
              report.topSold.map((p) => (
                <div
                  key={p.productId}
                  className="flex items-center justify-between gap-2 py-2 border-b border-border/40 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{p.productName}</p>
                    <p className="text-[11px] text-muted-foreground">{p.qty} un</p>
                  </div>
                  <span className="text-sm font-bold text-foreground shrink-0">{brl(p.revenue)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estoque Pronto + Produção Ativa */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border border-border/70 bg-card/90 shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Estoque de Produtos Acabados</CardTitle>
              <PackageOpen className="w-5 h-5 text-muted-foreground" />
            </div>
            <CardDescription>Saldo pronto para venda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!report?.productStock?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum produto com estoque.</p>
            ) : (
              report.productStock.map((s) => (
                <div
                  key={s.productId}
                  className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/40 last:border-0"
                >
                  <span className="font-medium text-foreground truncate">{s.productName}</span>
                  <span
                    className={cn(
                      "px-2 py-0.5 text-xs font-bold rounded-md shrink-0",
                      s.stockQty === 0
                        ? "bg-red-50 text-red-600"
                        : s.stockQty <= 3
                          ? "bg-amber-50 text-amber-600"
                          : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {formatQtyByUom(s.stockQty, "UNIT")} un
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card/90 shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Produção Ativa</CardTitle>
              <span className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full border border-primary/20 uppercase">
                {openOrdersCount} {openOrdersCount === 1 ? "Ordem" : "Ordens"}
              </span>
            </div>
            <CardDescription>Ordens de produção em andamento.</CardDescription>
          </CardHeader>
          <CardContent>
            {!report?.openOrders?.length ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Nenhuma OP em andamento.</p>
                <Button variant="outline" onClick={() => setLocation("/production")}>
                  Criar ordem de produção
                </Button>
              </div>
            ) : (
              <>
                {isMobile ? (
                  <div className="space-y-2">
                    {report.openOrders.map((o) => (
                      <div key={o.id} className="rounded-xl border border-border/50 bg-background p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-muted-foreground">OP-{o.id}</div>
                            <div className="truncate text-sm font-semibold text-foreground">{o.productName}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-xs text-muted-foreground">Qtd</div>
                            <div className="text-sm font-semibold text-foreground">{o.qtyPlanned}</div>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Criada em {format(new Date(o.createdAt), "dd/MM", { locale: ptBR })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="pb-2 text-left text-[10px] font-bold text-muted-foreground uppercase">
                          OP #
                        </th>
                        <th className="pb-2 text-left text-[10px] font-bold text-muted-foreground uppercase">
                          Produto
                        </th>
                        <th className="pb-2 text-right text-[10px] font-bold text-muted-foreground uppercase">
                          Qtd
                        </th>
                        <th className="pb-2 text-right text-[10px] font-bold text-muted-foreground uppercase">
                          Data
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.openOrders.map((o) => (
                        <tr key={o.id} className="border-b border-border/30 last:border-0">
                          <td className="py-2.5 font-medium text-muted-foreground">OP-{o.id}</td>
                          <td className="py-2.5 font-semibold text-foreground">{o.productName}</td>
                          <td className="py-2.5 text-right text-muted-foreground">{o.qtyPlanned}</td>
                          <td className="py-2.5 text-right text-muted-foreground">
                            {format(new Date(o.createdAt), "dd/MM", { locale: ptBR })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
