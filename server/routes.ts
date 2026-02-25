import type { Express } from "express";
import type { Server } from "http";
import { api } from "@shared/routes";
import { DrizzleErpRepository } from "./infra/repositories/drizzle-erp-repository";
import { ErpController, handleControllerError } from "./presentation/erp-controller";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const repository = new DrizzleErpRepository();
  const controller = new ErpController(repository);

  const withHandler = (handler: (req: any, res: any) => Promise<void>) => {
    return async (req: any, res: any) => {
      try {
        await handler(req, res);
      } catch (err) {
        handleControllerError(err, res);
      }
    };
  };

  app.get(api.materials.list.path, withHandler((req, res) => controller.listMaterials(req, res)));
  app.get(api.materials.get.path, withHandler((req, res) => controller.getMaterial(req, res)));
  app.post(api.materials.create.path, withHandler((req, res) => controller.createMaterial(req, res)));
  app.put(api.materials.update.path, withHandler((req, res) => controller.updateMaterial(req, res)));
  app.delete(api.materials.delete.path, withHandler((req, res) => controller.deleteMaterial(req, res)));

  app.get(api.products.list.path, withHandler((req, res) => controller.listProducts(req, res)));
  app.get(api.products.get.path, withHandler((req, res) => controller.getProduct(req, res)));
  app.post(api.products.create.path, withHandler((req, res) => controller.createProduct(req, res)));
  app.put(api.products.update.path, withHandler((req, res) => controller.updateProduct(req, res)));
  app.delete(api.products.delete.path, withHandler((req, res) => controller.deleteProduct(req, res)));

  app.get(api.productionOrders.list.path, withHandler((req, res) => controller.listProductionOrders(req, res)));
  app.get(api.productionOrders.get.path, withHandler((req, res) => controller.getProductionOrder(req, res)));
  app.post(api.productionOrders.create.path, withHandler((req, res) => controller.createProductionOrder(req, res)));
  app.post(api.productionOrders.conclude.path, withHandler((req, res) => controller.concludeProductionOrder(req, res)));

  app.get(api.sales.list.path, withHandler((req, res) => controller.listSales(req, res)));
  app.get(api.sales.get.path, withHandler((req, res) => controller.getSale(req, res)));
  app.post(api.sales.create.path, withHandler((req, res) => controller.createSale(req, res)));

  app.get(api.inventory.movements.path, withHandler((req, res) => controller.listInventoryMovements(req, res)));

  app.get(api.reports.production.path, withHandler((req, res) => controller.getProductionReport(req, res)));
  app.get(api.reports.leatherConsumption.path, withHandler((req, res) => controller.getLeatherConsumptionReport(req, res)));
  app.get(api.reports.sales.path, withHandler((req, res) => controller.getSalesReport(req, res)));

  return httpServer;
}
