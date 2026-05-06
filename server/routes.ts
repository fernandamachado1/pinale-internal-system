import type { Express } from "express";
import type { Server } from "http";
//@ts-ignore
import { api } from "@shared/routes";
import { DrizzleErpRepository } from "./infra/repositories/drizzle-erp-repository";
import { ErpController, handleControllerError } from "./presentation/erp-controller";
import { SalesController } from "./presentation/sales-controller";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const repository = new DrizzleErpRepository({});
  const controller = new ErpController(repository);
  const salesController = new SalesController(repository);

  const withHandler = (handler: (req: any, res: any) => Promise<void>) => {
    return async (req: any, res: any) => {
      try {
        await handler(req, res);
      } catch (err) {
        // Surface real failures in the server logs (the client only gets a safe message).
        console.error(`[api] ${req.method} ${req.path}`, err);
        handleControllerError(err, res);
      }
    };
  };

  app.get(api.materials.list.path, withHandler((req, res) => controller.listMaterials(req, res)));
  app.get(api.materials.get.path, withHandler((req, res) => controller.getMaterial(req, res)));
  app.post(api.materials.create.path, withHandler((req, res) => controller.createMaterial(req, res)));
  app.post(api.materials.createMany.path, withHandler((req, res) => controller.createManyMaterials(req, res)));
  app.put(api.materials.update.path, withHandler((req, res) => controller.updateMaterial(req, res)));
  app.delete(api.materials.delete.path, withHandler((req, res) => controller.deleteMaterial(req, res)));

  app.get(api.products.list.path, withHandler((req, res) => controller.listProducts(req, res)));
  app.get(api.products.catalog.path, withHandler((req, res) => controller.listCatalogProducts(req, res)));
  app.get(api.products.get.path, withHandler((req, res) => controller.getProduct(req, res)));
  app.post(api.products.create.path, withHandler((req, res) => controller.createProduct(req, res)));
  app.put(api.products.update.path, withHandler((req, res) => controller.updateProduct(req, res)));
  app.delete(api.products.delete.path, withHandler((req, res) => controller.deleteProduct(req, res)));

  app.get(api.productionOrders.list.path, withHandler((req, res) => controller.listProductionOrders(req, res)));
  app.get(api.productionOrders.get.path, withHandler((req, res) => controller.getProductionOrder(req, res)));
  app.post(api.productionOrders.create.path, withHandler((req, res) => controller.createProductionOrder(req, res)));
  app.put(api.productionOrders.update.path, withHandler((req, res) => controller.updateProductionOrder(req, res)));
  app.post(api.productionOrders.move.path, withHandler((req, res) => controller.moveProductionOrder(req, res)));
  app.patch(api.productionOrders.updateFinancials.path, withHandler((req, res) => controller.updateProductionOrderFinancials(req, res)));
  app.post(api.productionOrders.conclude.path, withHandler((req, res) => controller.concludeProductionOrder(req, res)));
  app.post(api.productionOrders.deliver.path, withHandler((req, res) => controller.deliverProductionOrder(req, res)));
  app.delete(api.productionOrders.delete.path, withHandler((req, res) => controller.deleteProductionOrder(req, res)));
  app.get(api.producedProductStocks.list.path, withHandler((req, res) => controller.listProducedProductStocks(req, res)));
  app.get(api.producedProductStocks.summary.path, withHandler((req, res) => controller.listProducedProductStockSummary(req, res)));
  app.post(api.producedProductStocks.registerInitial.path, withHandler((req, res) => controller.registerInitialProducedStock(req, res)));
  app.post(api.producedProductStocks.adjust.path, withHandler((req, res) => controller.adjustProducedStock(req, res)));

  app.get(api.sales.list.path, withHandler((req, res) => salesController.listSales(req, res)));
  app.get(api.sales.get.path, withHandler((req, res) => salesController.getSale(req, res)));
  app.post(api.sales.create.path, withHandler((req, res) => salesController.createSale(req, res)));
  app.put(api.sales.update.path, withHandler((req, res) => salesController.updateSale(req, res)));
  app.delete(api.sales.delete.path, withHandler((req, res) => salesController.deleteSale(req, res)));

  app.get(api.inventory.movements.path, withHandler((req, res) => controller.listInventoryMovements(req, res)));

  app.get(api.purchaseOrders.list.path, withHandler((req, res) => controller.listPurchaseOrders(req, res)));
  app.get(api.purchaseOrders.get.path, withHandler((req, res) => controller.getPurchaseOrder(req, res)));
  app.post(api.purchaseOrders.reorder.path, withHandler((req, res) => controller.reorderPurchaseOrders(req, res)));
  app.post(api.purchaseOrders.create.path, withHandler((req, res) => controller.createPurchaseOrder(req, res)));
  app.put(api.purchaseOrders.update.path, withHandler((req, res) => controller.updatePurchaseOrder(req, res)));
  app.post(api.purchaseOrders.receive.path, withHandler((req, res) => controller.receivePurchaseOrder(req, res)));
  app.delete(api.purchaseOrders.cancel.path, withHandler((req, res) => controller.cancelPurchaseOrder(req, res)));

  app.get(api.reports.production.path, withHandler((req, res) => controller.getProductionReport(req, res)));
  app.get(api.reports.leatherConsumption.path, withHandler((req, res) => controller.getLeatherConsumptionReport(req, res)));
  app.get(api.reports.sales.path, withHandler((req, res) => controller.getSalesReport(req, res)));
  app.get(api.reports.dashboard.path, withHandler((req, res) => controller.getDashboardReport(req, res)));

  return httpServer;
}
