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
  products,
  producedProductStocks,
  saleItems,
  sales,
} from "./shared/schema";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
  await db.delete(inventoryMovements);
  await db.delete(saleItems);
  await db.delete(sales);
  await db.delete(productionOrders);
  await db.delete(bomItems);
  await db.delete(boms);
  await db.delete(producedProductStocks);
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
    unitOfMeasure: "UNIT",
    stockQty: "10.000",
    category: "NOTIONS",
    purchasePrice: "5.00",
    pricePerSquareMeter: null,
    isActive: 1,
  });

  await repository.deactivateMaterial(zipper.id);
  const zipperReactivated = await createMaterial.execute({
    name: "Ziper 20cm",
    unitOfMeasure: "UNIT",
    stockQty: "10.000",
    category: "NOTIONS",
    purchasePrice: "5.00",
    pricePerSquareMeter: null,
    isActive: 1,
  });
  assert(zipperReactivated.id === zipper.id, "reactivated material should preserve id");
  assert(zipperReactivated.isActive === 1, "reactivated material should become active");

  const leather = await createMaterial.execute({
    name: "Couro Premium",
    unitOfMeasure: "SQUARE_METER",
    stockQty: "5.000",
    category: "RAW_MATERIAL",
    purchasePrice: "120.00",
    pricePerSquareMeter: "120.00",
    isActive: 1,
  });

  const product = await createProduct.execute({
    product: {
      name: "Bolsa Pitanga",
      price: "120.00",
      isActive: 1,
    },
    technicalSpec: {
      bomItems: [
        { materialId: zipper.id, qtyPerUnit: "1.000" },
        { materialId: leather.id, qtyPerUnit: "0.500" },
      ],
    },
  });

  assert(product.bomItems.length === 2, "product BOM should have 2 materials");

  // Regression: older data might miss produced stock rows. Conclusion must recreate it.
  await db.delete(producedProductStocks);

  const order = await createOrder.execute({
    productId: product.id,
    qtyPlanned: 2,
  });
  assert(order.status === "OPEN", "production order should start OPEN");

  await concludeOrder.execute(order.id, {});

  const orderAfter = await repository.getProductionOrder(order.id);
  assert(orderAfter?.status === "DONE", "production order should become DONE");

  const zipperAfter = await repository.getMaterial(zipper.id);
  assert(Number(zipperAfter?.stockQty) === 8, "fixed material stock should be decremented");

  const leatherAfter = await repository.getMaterial(leather.id);
  assert(Number(leatherAfter?.stockQty) === 4, "raw material stock should be decremented");

  const producedStockAfterProduction = await repository.getProducedProductStockByProductId(product.id);
  assert(producedStockAfterProduction?.stockQty === 2, "produced stock should increase after production");

  await createSale.execute({
    paymentMethod: "PIX",
    items: [{ productId: product.id, qty: 1 }],
  });

  const producedStockAfterSale = await repository.getProducedProductStockByProductId(product.id);
  assert(producedStockAfterSale?.stockQty === 1, "produced stock should decrease after sale");

  const movements = await repository.getInventoryMovements();
  assert(movements.length === 4, "ledger should have 4 movements (two material outs, product in, product out)");

  const productionReport = await createProductionReport.execute({});
  assert(productionReport.totalOps === 1, "production report should count 1 OP");

  const leatherReport = await createLeatherReport.execute({});
  assert(leatherReport.totalGeneral === 2, "material consumption report should aggregate all BOM consumption on OP conclusion");

  const salesReport = await createSalesReport.execute({});
  assert(salesReport.totalRevenue === 120, "sales report should aggregate revenue");

  console.log("SMOKE TEST OK");
  console.log({
    productionOrderStatus: orderAfter?.status,
    zipperStock: zipperAfter?.stockQty,
    leatherStock: leatherAfter?.stockQty,
    productStockAfterSale: producedStockAfterSale?.stockQty,
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
