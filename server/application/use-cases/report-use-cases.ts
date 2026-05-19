import type { IErpRepository } from "../contracts/erp-repository.ts";

export interface PeriodInput {
  from?: Date;
  to?: Date;
}

export class ProductionReportUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(period: PeriodInput) {
    const doneOrders = await this.repository.getProductionOrders({
      status: ["DONE"],
      from: period.from,
      to: period.to,
    });
    const movements = await this.repository.getInventoryMovements({
      from: period.from,
      to: period.to,
      entityType: "MATERIAL",
      direction: "OUT",
      reason: ["PRODUCTION_CONSUMPTION"],
    });

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
    const movements = await this.repository.getInventoryMovements({
      from: period.from,
      to: period.to,
      entityType: "MATERIAL",
      direction: "OUT",
      reason: ["PRODUCTION_CONSUMPTION"],
      referenceType: ["OP"],
    });
    const referenceIds = Array.from(new Set(movements.flatMap((movement) => (movement.referenceId ? [movement.referenceId] : []))));
    const orders = await this.repository.getProductionOrdersByIds(referenceIds);
    const productByOrderId = new Map(orders.map((order) => [order.id, order.product]));

    const byProductMap = new Map<number, { productId: number; productName: string; qty: number }>();
    let totalGeneral = 0;

    for (const movement of movements) {
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
    const salesItems = await this.repository.getSales({
      from: period.from,
      to: period.to,
    });

    let totalRevenue = 0;
    const soldByProductMap = new Map<number, { productId: number; productName: string; qty: number; revenue: number }>();
    const revenueByPaymentMap = new Map<string, number>();

    for (const item of salesItems) {
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
    return this.repository.getDashboardReport(period);
  }
}
