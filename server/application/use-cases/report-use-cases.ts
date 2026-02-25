import type { IErpRepository } from "../contracts/erp-repository";

interface PeriodInput {
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
      if (movement.entityType !== "MATERIAL_GROUP") return false;
      if (movement.group !== "LEATHER") return false;
      if (movement.direction !== "OUT") return false;
      if (movement.reason !== "PRODUCTION_CONSUMPTION") return false;
      return true;
    });

    const byThicknessMap = new Map<string, number>();
    const byProductMap = new Map<number, { productId: number; productName: string; qty: number }>();
    let totalGeneral = 0;

    for (const movement of filtered) {
      const qty = Number(movement.qty);
      totalGeneral += qty;

      const thickness = String((movement.metadata as Record<string, unknown> | null)?.thicknessMm ?? "unknown");
      byThicknessMap.set(thickness, (byThicknessMap.get(thickness) ?? 0) + qty);

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
      byThickness: Array.from(byThicknessMap.entries()).map(([thicknessMm, qty]) => ({ thicknessMm, qty })),
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
