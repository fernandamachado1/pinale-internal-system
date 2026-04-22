import type { Request, Response } from "express";
import { z } from "zod";
import { api } from "@shared/routes";
import { DomainError } from "../domain/errors/domain-error";
import type { IErpRepository } from "../application/contracts/erp-repository";
import { AdjustMaterialStockUseCase } from "../application/use-cases/adjust-material-stock-use-case";
import { CompleteProductionUseCase } from "../application/use-cases/complete-production-use-case";
import {
  CreateMaterialUseCase,
  CreateManyMaterialsUseCase,
  DeleteMaterialUseCase,
  GetMaterialUseCase,
  ListMaterialsUseCase,
  UpdateMaterialUseCase,
} from "../application/use-cases/material-use-cases";
import {
  CreateProductUseCase,
  DeleteProductUseCase,
  GetProductUseCase,
  ListCatalogProductsUseCase,
  ListProductsUseCase,
  UpdateProductUseCase,
} from "../application/use-cases/product-use-cases";
import {
  CreateProductionOrderUseCase,
  GetProductionOrderUseCase,
  ListProductionOrdersUseCase,
  MoveProductionOrderUseCase,
} from "../application/use-cases/production-use-cases";
import {
  AdjustProducedStockUseCase,
  ListProducedProductStockSummaryUseCase,
  ListProducedProductStocksUseCase,
  RegisterInitialProducedStockUseCase,
} from "../application/use-cases/produced-product-stock-use-cases";
import { ListInventoryMovementsUseCase } from "../application/use-cases/inventory-movement-use-cases";
import { DashboardReportUseCase, LeatherConsumptionReportUseCase, ProductionReportUseCase, SalesReportUseCase } from "../application/use-cases/report-use-cases";
import {
  CancelPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  GetPurchaseOrderUseCase as GetPurchaseOrderEntityUseCase,
  ListPurchaseOrdersUseCase,
  ReorderPurchaseOrdersUseCase,
  ReceivePurchaseOrderUseCase,
  UpdatePurchaseOrderUseCase,
} from "../application/use-cases/purchase-order-use-cases";

export class ErpController {
  private readonly listMaterialsUseCase: ListMaterialsUseCase;
  private readonly getMaterialUseCase: GetMaterialUseCase;
  private readonly createMaterialUseCase: CreateMaterialUseCase;
  private readonly createManyMaterialsUseCase: CreateManyMaterialsUseCase;
  private readonly updateMaterialUseCase: UpdateMaterialUseCase;
  private readonly deleteMaterialUseCase: DeleteMaterialUseCase;
  private readonly adjustMaterialStockUseCase: AdjustMaterialStockUseCase;

  private readonly listProductsUseCase: ListProductsUseCase;
  private readonly listCatalogProductsUseCase: ListCatalogProductsUseCase;
  private readonly getProductUseCase: GetProductUseCase;
  private readonly createProductUseCase: CreateProductUseCase;
  private readonly updateProductUseCase: UpdateProductUseCase;
  private readonly deleteProductUseCase: DeleteProductUseCase;

  private readonly listProductionOrdersUseCase: ListProductionOrdersUseCase;
  private readonly getProductionOrderUseCase: GetProductionOrderUseCase;
  private readonly createProductionOrderUseCase: CreateProductionOrderUseCase;
  private readonly moveProductionOrderUseCase: MoveProductionOrderUseCase;
  private readonly completeProductionUseCase: CompleteProductionUseCase;
  private readonly listProducedProductStocksUseCase: ListProducedProductStocksUseCase;
  private readonly listProducedProductStockSummaryUseCase: ListProducedProductStockSummaryUseCase;
  private readonly registerInitialProducedStockUseCase: RegisterInitialProducedStockUseCase;
  private readonly adjustProducedStockUseCase: AdjustProducedStockUseCase;

  private readonly listInventoryMovementsUseCase: ListInventoryMovementsUseCase;

  private readonly listPurchaseOrdersUseCase: ListPurchaseOrdersUseCase;
  private readonly getPurchaseOrderUseCase: GetPurchaseOrderEntityUseCase;
  private readonly reorderPurchaseOrdersUseCase: ReorderPurchaseOrdersUseCase;
  private readonly createPurchaseOrderUseCase: CreatePurchaseOrderUseCase;
  private readonly updatePurchaseOrderUseCase: UpdatePurchaseOrderUseCase;
  private readonly receivePurchaseOrderUseCase: ReceivePurchaseOrderUseCase;
  private readonly cancelPurchaseOrderUseCase: CancelPurchaseOrderUseCase;

  private readonly productionReportUseCase: ProductionReportUseCase;
  private readonly leatherConsumptionReportUseCase: LeatherConsumptionReportUseCase;
  private readonly salesReportUseCase: SalesReportUseCase;
  private readonly dashboardReportUseCase: DashboardReportUseCase;

  constructor(private readonly repository: IErpRepository) {
    this.listMaterialsUseCase = new ListMaterialsUseCase(repository);
    this.getMaterialUseCase = new GetMaterialUseCase(repository);
    this.createMaterialUseCase = new CreateMaterialUseCase(repository);
    this.createManyMaterialsUseCase = new CreateManyMaterialsUseCase(repository);
    this.updateMaterialUseCase = new UpdateMaterialUseCase(repository);
    this.deleteMaterialUseCase = new DeleteMaterialUseCase(repository);
    this.adjustMaterialStockUseCase = new AdjustMaterialStockUseCase(repository);

    this.listProductsUseCase = new ListProductsUseCase(repository);
    this.listCatalogProductsUseCase = new ListCatalogProductsUseCase(repository);
    this.getProductUseCase = new GetProductUseCase(repository);
    this.createProductUseCase = new CreateProductUseCase(repository);
    this.updateProductUseCase = new UpdateProductUseCase(repository);
    this.deleteProductUseCase = new DeleteProductUseCase(repository);

    this.listProductionOrdersUseCase = new ListProductionOrdersUseCase(repository);
    this.getProductionOrderUseCase = new GetProductionOrderUseCase(repository);
    this.createProductionOrderUseCase = new CreateProductionOrderUseCase(repository);
    this.moveProductionOrderUseCase = new MoveProductionOrderUseCase(repository);
    this.completeProductionUseCase = new CompleteProductionUseCase(repository);
    this.listProducedProductStocksUseCase = new ListProducedProductStocksUseCase(repository);
    this.listProducedProductStockSummaryUseCase = new ListProducedProductStockSummaryUseCase(repository);
    this.registerInitialProducedStockUseCase = new RegisterInitialProducedStockUseCase(repository);
    this.adjustProducedStockUseCase = new AdjustProducedStockUseCase(repository);

    this.listInventoryMovementsUseCase = new ListInventoryMovementsUseCase(repository);

    this.listPurchaseOrdersUseCase = new ListPurchaseOrdersUseCase(repository);
    this.getPurchaseOrderUseCase = new GetPurchaseOrderEntityUseCase(repository);
    this.reorderPurchaseOrdersUseCase = new ReorderPurchaseOrdersUseCase(repository);
    this.createPurchaseOrderUseCase = new CreatePurchaseOrderUseCase(repository);
    this.updatePurchaseOrderUseCase = new UpdatePurchaseOrderUseCase(repository);
    this.receivePurchaseOrderUseCase = new ReceivePurchaseOrderUseCase(repository);
    this.cancelPurchaseOrderUseCase = new CancelPurchaseOrderUseCase(repository);

    this.productionReportUseCase = new ProductionReportUseCase(repository);
    this.leatherConsumptionReportUseCase = new LeatherConsumptionReportUseCase(repository);
    this.salesReportUseCase = new SalesReportUseCase(repository);
    this.dashboardReportUseCase = new DashboardReportUseCase(repository);
  }

  async listMaterials(_req: Request, res: Response): Promise<void> {
    res.json(await this.listMaterialsUseCase.execute());
  }

  async getMaterial(req: Request, res: Response): Promise<void> {
    res.json(await this.getMaterialUseCase.execute(Number(req.params.id)));
  }

  async createMaterial(req: Request, res: Response): Promise<void> {
    const input = api.materials.create.input.parse(req.body);
    res.status(201).json(await this.createMaterialUseCase.execute(input));
  }

  async createManyMaterials(req: Request, res: Response): Promise<void> {
    const input = api.materials.createMany.input.parse(req.body);
    res.status(201).json(await this.createManyMaterialsUseCase.execute(input));
  }

  async updateMaterial(req: Request, res: Response): Promise<void> {
    const input = api.materials.update.input.parse(req.body);
    res.json(await this.updateMaterialUseCase.execute(Number(req.params.id), input));
  }

  async deleteMaterial(req: Request, res: Response): Promise<void> {
    await this.deleteMaterialUseCase.execute(Number(req.params.id));
    res.status(204).send();
  }

  async adjustMaterialStock(req: Request, res: Response): Promise<void> {
    const input = z.object({ quantityChange: z.number(), reason: z.string() }).parse(req.body);
    const result = await this.adjustMaterialStockUseCase.execute({
      materialId: Number(req.params.id),
      quantityChange: input.quantityChange,
      reason: input.reason,
    });

    const material = await this.getMaterialUseCase.execute(result.materialId);
    res.json(material);
  }

  async listProducts(_req: Request, res: Response): Promise<void> {
    res.json(await this.listProductsUseCase.execute());
  }

  async listCatalogProducts(req: Request, res: Response): Promise<void> {
    const query = api.products.catalog.query.parse(req.query);
    res.json(await this.listCatalogProductsUseCase.execute(query));
  }

  async getProduct(req: Request, res: Response): Promise<void> {
    res.json(await this.getProductUseCase.execute(Number(req.params.id)));
  }

  async createProduct(req: Request, res: Response): Promise<void> {
    const input = api.products.create.input.parse(req.body);
    res.status(201).json(await this.createProductUseCase.execute(input));
  }

  async updateProduct(req: Request, res: Response): Promise<void> {
    const input = api.products.update.input.parse(req.body);
    res.json(await this.updateProductUseCase.execute(Number(req.params.id), input));
  }

  async deleteProduct(req: Request, res: Response): Promise<void> {
    await this.deleteProductUseCase.execute(Number(req.params.id));
    res.status(204).send();
  }

  async listProductionOrders(_req: Request, res: Response): Promise<void> {
    res.json(await this.listProductionOrdersUseCase.execute());
  }

  async getProductionOrder(req: Request, res: Response): Promise<void> {
    const order = await this.getProductionOrderUseCase.execute(Number(req.params.id));
    res.json(order);
  }

  async createProductionOrder(req: Request, res: Response): Promise<void> {
    const input = api.productionOrders.create.input.parse(req.body);
    res.status(201).json(await this.createProductionOrderUseCase.execute(input));
  }

  async moveProductionOrder(req: Request, res: Response): Promise<void> {
    const input = api.productionOrders.move.input.parse(req.body);
    res.json(await this.moveProductionOrderUseCase.execute(Number(req.params.id), input));
  }

  async concludeProductionOrder(req: Request, res: Response): Promise<void> {
    const input = api.productionOrders.conclude.input.parse(req.body);
    await this.completeProductionUseCase.execute(Number(req.params.id), input);
    res.json(await this.getProductionOrderUseCase.execute(Number(req.params.id)));
  }

  async listProducedProductStocks(_req: Request, res: Response): Promise<void> {
    res.json(await this.listProducedProductStocksUseCase.execute());
  }

  async listProducedProductStockSummary(_req: Request, res: Response): Promise<void> {
    res.json(await this.listProducedProductStockSummaryUseCase.execute());
  }

  async registerInitialProducedStock(req: Request, res: Response): Promise<void> {
    const input = api.producedProductStocks.registerInitial.input.parse(req.body);
    res.json(await this.registerInitialProducedStockUseCase.execute(input));
  }

  async adjustProducedStock(req: Request, res: Response): Promise<void> {
    const input = api.producedProductStocks.adjust.input.parse(req.body);
    res.json(await this.adjustProducedStockUseCase.execute(input));
  }

  async listInventoryMovements(_req: Request, res: Response): Promise<void> {
    res.json(await this.listInventoryMovementsUseCase.execute());
  }

  async listPurchaseOrders(_req: Request, res: Response): Promise<void> {
    res.json(await this.listPurchaseOrdersUseCase.execute());
  }

  async getPurchaseOrder(req: Request, res: Response): Promise<void> {
    res.json(await this.getPurchaseOrderUseCase.execute(Number(req.params.id)));
  }

  async reorderPurchaseOrders(req: Request, res: Response): Promise<void> {
    const input = api.purchaseOrders.reorder.input.parse(req.body);
    await this.reorderPurchaseOrdersUseCase.execute(input);
    res.status(204).send();
  }

  async createPurchaseOrder(req: Request, res: Response): Promise<void> {
    const input = api.purchaseOrders.create.input.parse(req.body);
    res.status(201).json(await this.createPurchaseOrderUseCase.execute(input));
  }

  async updatePurchaseOrder(req: Request, res: Response): Promise<void> {
    const input = api.purchaseOrders.update.input.parse(req.body);
    res.json(await this.updatePurchaseOrderUseCase.execute(Number(req.params.id), input));
  }

  async receivePurchaseOrder(req: Request, res: Response): Promise<void> {
    const input = api.purchaseOrders.receive.input.parse(req.body);
    res.json(await this.receivePurchaseOrderUseCase.execute(Number(req.params.id), input));
  }

  async cancelPurchaseOrder(req: Request, res: Response): Promise<void> {
    await this.cancelPurchaseOrderUseCase.execute(Number(req.params.id));
    res.status(204).send();
  }

  private getPeriod(req: Request): { from?: Date; to?: Date } {
    const query = z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() }).parse(req.query);
    return {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    };
  }

  async getProductionReport(req: Request, res: Response): Promise<void> {
    res.json(await this.productionReportUseCase.execute(this.getPeriod(req)));
  }

  async getLeatherConsumptionReport(req: Request, res: Response): Promise<void> {
    res.json(await this.leatherConsumptionReportUseCase.execute(this.getPeriod(req)));
  }

  async getSalesReport(req: Request, res: Response): Promise<void> {
    res.json(await this.salesReportUseCase.execute(this.getPeriod(req)));
  }

  async getDashboardReport(req: Request, res: Response): Promise<void> {
    res.json(await this.dashboardReportUseCase.execute(this.getPeriod(req)));
  }
}

export function handleControllerError(err: unknown, res: Response): void {
  if (err instanceof z.ZodError) {
    res.status(400).json({
      message: err.errors[0]?.message ?? "Validation error",
      field: err.errors[0]?.path.join("."),
      code: "VALIDATION_ERROR",
    });
    return;
  }

  if (err instanceof DomainError) {
    res.status(err.statusCode).json({ message: err.message, code: err.code });
    return;
  }

  if (err instanceof Error) {
    const message = err.message?.trim() ? err.message : "Internal server error";
    // pg/Drizzle errors often carry useful context in extra fields.
    const details =
      typeof (err as any)?.detail === "string" && (err as any).detail.trim()
        ? String((err as any).detail)
        : undefined;

    res.status(500).json(details ? { message, details } : { message });
    return;
  }

  res.status(500).json({ message: "Internal server error" });
}
