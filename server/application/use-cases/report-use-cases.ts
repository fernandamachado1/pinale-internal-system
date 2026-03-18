import type { IErpRepository } from "../contracts/erp-repository";

export interface PeriodInput {
  from?: Date;
  to?: Date;
}

function inPeriod(date: Date, period: PeriodInput): boolean {
  if (period.from && date < period.from) return false;
  if (period.to && date > period.to) return false;
  return true;
}

export class ProductionReportUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(period: PeriodInput) {
    const orders = await this.repository.getProductionOrders();
    const movements = await this.repository.getInventoryMovements();

    const doneOrders = orders.filter((order) => order.status === "DONE" && inPeriod(new Date(order.createdAt), period));

    const producedByProductMap = new Map<number, { productId: number; productName: string; qtyProduced: number }>();
    for (const order of doneOrders) {
      const current = producedByProductMap.get(order.productId) ?? {
        productId: order.productId,
        productName: order.product.name,
        qtyProduced: 0,
      };
      current.qtyProduced += order.qtyPlanned;
      producedByProductMap.set(order.productId, current);
    }

    const fixedMaterialConsumptionMap = new Map<number, { materialId: number; materialName: string; qty: number }>();
    for (const movement of movements) {
      if (!inPeriod(new Date(movement.createdAt), period)) continue;
      if (movement.entityType !== "MATERIAL") continue;
      if (movement.direction !== "OUT") continue;
      if (movement.reason !== "PRODUCTION_CONSUMPTION") continue;
      if (!movement.entityId || !movement.material) continue;

      const current = fixedMaterialConsumptionMap.get(movement.entityId) ?? {
        materialId: movement.entityId,
        materialName: movement.material.name,
        qty: 0,
      };

      current.qty += Number(movement.qty);
      fixedMaterialConsumptionMap.set(movement.entityId, current);
    }

    return {
      totalOps: doneOrders.length,
      producedByProduct: Array.from(producedByProductMap.values()),
      fixedMaterialConsumption: Array.from(fixedMaterialConsumptionMap.values()),
    };
  }
}

export class LeatherConsumptionReportUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(period: PeriodInput) {
    const movements = await this.repository.getInventoryMovements();
    const orders = await this.repository.getProductionOrders();
    const productByOrderId = new Map(orders.map((order) => [order.id, order.product]));

    const filtered = movements.filter((movement) => {
      if (!inPeriod(new Date(movement.createdAt), period)) return false;
      if (movement.entityType !== "MATERIAL") return false;
      if (movement.direction !== "OUT") return false;
      if (movement.reason !== "PRODUCTION_CONSUMPTION") return false;
      return true;
    });

    const byProductMap = new Map<number, { productId: number; productName: string; qty: number }>();
    let totalGeneral = 0;

    for (const movement of filtered) {
      const qty = Number(movement.qty);
      totalGeneral += qty;

      if (movement.referenceId) {
        const product = productByOrderId.get(movement.referenceId);
        if (product) {
          const current = byProductMap.get(product.id) ?? { productId: product.id, productName: product.name, qty: 0 };
          current.qty += qty;
          byProductMap.set(product.id, current);
        }
      }
    }

    return {
      totalGeneral,
      byProduct: Array.from(byProductMap.values()),
    };
  }
}

export class SalesReportUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(period: PeriodInput) {
    const salesItems = await this.repository.getSales();

    const filtered = salesItems.filter((item) => inPeriod(new Date(item.sale.createdAt), period));

    let totalRevenue = 0;
    const soldByProductMap = new Map<number, { productId: number; productName: string; qty: number; revenue: number }>();
    const revenueByPaymentMap = new Map<string, number>();

    for (const item of filtered) {
      const revenue = Number(item.totalPrice);
      totalRevenue += revenue;

      const currentProduct = soldByProductMap.get(item.productId) ?? {
        productId: item.productId,
        productName: item.product.name,
        qty: 0,
        revenue: 0,
      };
      currentProduct.qty += item.qty;
      currentProduct.revenue += revenue;
      soldByProductMap.set(item.productId, currentProduct);

      const method = item.sale.paymentMethod;
      revenueByPaymentMap.set(method, (revenueByPaymentMap.get(method) ?? 0) + revenue);
    }

    return {
      totalRevenue,
      soldByProduct: Array.from(soldByProductMap.values()),
      revenueByPaymentMethod: Array.from(revenueByPaymentMap.entries()).map(([paymentMethod, revenue]) => ({ paymentMethod, revenue })),
    };
  }
}

export class DashboardReportUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(period: PeriodInput) {
    const [orders, salesItems, stocks] = await Promise.all([
      this.repository.getProductionOrders(),
      this.repository.getSales(),
      this.repository.getProducedProductStocks(),
    ]);

    const filteredOrders = orders.filter(
      (o) => o.status === "DONE" && o.completedAt && inPeriod(new Date(o.completedAt), period),
    );
    const filteredSales = salesItems.filter((s) => inPeriod(new Date(s.sale.createdAt), period));

    const allOpenOrders = orders.filter((o) => o.status !== "DONE");
    const openOrders = allOpenOrders
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        productName: o.product.name,
        qtyPlanned: o.qtyPlanned,
        createdAt: new Date(o.createdAt).toISOString(),
      }));

    const producedValue = filteredOrders.reduce((acc, o) => acc + o.qtyPlanned * Number(o.product.price), 0);
    const soldValue = filteredSales.reduce((acc, s) => acc + Number(s.totalPrice), 0);
    const distinctSaleCount = new Set(filteredSales.map((s) => s.saleId)).size;

    const producedByProductMap = new Map<number, { productId: number; productName: string; qty: number; value: number }>();
    for (const order of filteredOrders) {
      const cur = producedByProductMap.get(order.productId) ?? { productId: order.productId, productName: order.product.name, qty: 0, value: 0 };
      cur.qty += order.qtyPlanned;
      cur.value += order.qtyPlanned * Number(order.product.price);
      producedByProductMap.set(order.productId, cur);
    }

    const soldByProductMap = new Map<number, { productId: number; productName: string; qty: number; revenue: number }>();
    for (const item of filteredSales) {
      const cur = soldByProductMap.get(item.productId) ?? { productId: item.productId, productName: item.product.name, qty: 0, revenue: 0 };
      cur.qty += item.qty;
      cur.revenue += Number(item.totalPrice);
      soldByProductMap.set(item.productId, cur);
    }

    const chartMap = new Map<string, { date: string; producedValue: number; soldValue: number }>();
    for (const order of filteredOrders) {
      if (!order.completedAt) continue;
      const date = new Date(order.completedAt).toISOString().slice(0, 10);
      const cur = chartMap.get(date) ?? { date, producedValue: 0, soldValue: 0 };
      cur.producedValue += order.qtyPlanned * Number(order.product.price);
      chartMap.set(date, cur);
    }
    for (const item of filteredSales) {
      const date = new Date(item.sale.createdAt).toISOString().slice(0, 10);
      const cur = chartMap.get(date) ?? { date, producedValue: 0, soldValue: 0 };
      cur.soldValue += Number(item.totalPrice);
      chartMap.set(date, cur);
    }

    const productStock = stocks
      .sort((a, b) => b.stockQty - a.stockQty)
      .slice(0, 8)
      .map((s) => ({ productId: s.productId, productName: s.product.name, stockQty: s.stockQty }));

    return {
      producedValue,
      soldValue,
      distinctSaleCount,
      openOrdersCount: allOpenOrders.length,
      topProduced: Array.from(producedByProductMap.values()).sort((a, b) => b.value - a.value).slice(0, 5),
      topSold: Array.from(soldByProductMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      chartSeries: Array.from(chartMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      openOrders,
      productStock,
    };
  }
}
