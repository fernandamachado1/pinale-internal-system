import { DrizzleErpRepository } from "./server/infra/repositories/drizzle-erp-repository";
import { CreateMaterialUseCase } from "./server/application/use-cases/material-use-cases";
import { CreateProductUseCase } from "./server/application/use-cases/product-use-cases";
import { CreateProductionOrderUseCase } from "./server/application/use-cases/production-use-cases";
import { CompleteProductionUseCase } from "./server/application/use-cases/complete-production-use-case";
import { CreateSaleUseCase } from "./server/application/use-cases/create-sale-use-case";
import { LeatherConsumptionReportUseCase, ProductionReportUseCase, SalesReportUseCase } from "./server/application/use-cases/report-use-cases";
import { db } from "./server/db";
import {
  bomItems,
  boms,
  inventoryMovements,
  materials,
  productionOrders,
  productionVariableConsumptions,
  products,
  saleItems,
  sales,
} from "./shared/schema";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
  await db.delete(inventoryMovements);
  await db.delete(productionVariableConsumptions);
  await db.delete(saleItems);
  await db.delete(sales);
  await db.delete(productionOrders);
  await db.delete(bomItems);
  await db.delete(boms);
  await db.delete(products);
  await db.delete(materials);

  const repository = new DrizzleErpRepository();

  const createMaterial = new CreateMaterialUseCase(repository);
  const createProduct = new CreateProductUseCase(repository);
  const createOrder = new CreateProductionOrderUseCase(repository);
  const concludeOrder = new CompleteProductionUseCase(repository);
  const createSale = new CreateSaleUseCase(repository);

  const createProductionReport = new ProductionReportUseCase(repository);
  const createLeatherReport = new LeatherConsumptionReportUseCase(repository);
  const createSalesReport = new SalesReportUseCase(repository);

  const zipper = await createMaterial.execute({
    name: "Ziper 20cm",
    unit: "UN",
    policy: "STOCK_CONTROLLED",
    stockQty: "10.000",
    group: "HARDWARE",
    isActive: 1,
  });

  await createMaterial.execute({
    name: "Couro",
    unit: "M2",
    policy: "CONSUMPTION_TRACKED",
    stockQty: null,
    group: "LEATHER",
    isActive: 1,
  });

  const product = await createProduct.execute({
    product: {
      name: "Bolsa Pitanga",
      price: "120.00",
      isActive: 1,
    },
    bomItems: [
      {
        itemType: "FIXED_MATERIAL",
        materialId: zipper.id,
        qtyPerUnit: "1.000",
      },
      {
        itemType: "VARIABLE_MATERIAL",
        materialGroup: "LEATHER",
        plannedQtyPerUnit: "0.500",
        unit: "M2",
      },
    ],
  });

  assert(product.bomItems.length === 2, "product BOM should have 2 items");

  const order = await createOrder.execute({
    productId: product.id,
    qtyPlanned: 2,
  });
  assert(order.status === "OPEN", "production order should start OPEN");

  await concludeOrder.execute(order.id, {
    consumptions: [
      {
        materialGroup: "LEATHER",
        quantityUsed: "1.250",
        thicknessMm: "1.600",
        panelsCount: 4,
        note: "lote A",
      },
    ],
  });

  const orderAfter = await repository.getProductionOrder(order.id);
  assert(orderAfter?.status === "DONE", "production order should become DONE");

  const zipperAfter = await repository.getMaterial(zipper.id);
  assert(Number(zipperAfter?.stockQty) === 8, "fixed material stock should be decremented");

  const productAfterProduction = await repository.getProduct(product.id);
  assert(productAfterProduction?.stockQty === 2, "product stock should increase after production");

  await createSale.execute({
    paymentMethod: "PIX",
    items: [{ productId: product.id, qty: 1 }],
  });

  const productAfterSale = await repository.getProduct(product.id);
  assert(productAfterSale?.stockQty === 1, "product stock should decrease after sale");

  const movements = await repository.getInventoryMovements();
  assert(movements.length === 4, "ledger should have 4 movements (fixed out, variable out, product in, product out)");

  const productionReport = await createProductionReport.execute({});
  assert(productionReport.totalOps === 1, "production report should count 1 OP");

  const leatherReport = await createLeatherReport.execute({});
  assert(leatherReport.totalGeneral === 1.25, "leather report should aggregate variable consumption");

  const salesReport = await createSalesReport.execute({});
  assert(salesReport.totalRevenue === 120, "sales report should aggregate revenue");

  console.log("SMOKE TEST OK");
  console.log({
    productionOrderStatus: orderAfter?.status,
    zipperStock: zipperAfter?.stockQty,
    productStockAfterSale: productAfterSale?.stockQty,
    movements: movements.length,
    productionReport,
    leatherReport,
    salesReport,
  });
}

run().catch((error) => {
  console.error("SMOKE TEST FAILED");
  console.error(error);
  process.exit(1);
});
