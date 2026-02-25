import type { Request, Response } from "express";
import { z } from "zod";
import { api } from "@shared/routes";
import { DomainError } from "../domain/errors/domain-error";
import type { IErpRepository } from "../application/contracts/erp-repository";
import { AdjustMaterialStockUseCase } from "../application/use-cases/adjust-material-stock-use-case";
import { CompleteProductionUseCase } from "../application/use-cases/complete-production-use-case";
import { CreateSaleUseCase } from "../application/use-cases/create-sale-use-case";
import {
  CreateMaterialUseCase,
  DeleteMaterialUseCase,
  GetMaterialUseCase,
  ListMaterialsUseCase,
  UpdateMaterialUseCase,
} from "../application/use-cases/material-use-cases";
import {
  CreateProductUseCase,
  DeleteProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
  UpdateProductUseCase,
} from "../application/use-cases/product-use-cases";
import {
  CreateProductionOrderUseCase,
  GetProductionOrderUseCase,
  ListProductionOrdersUseCase,
} from "../application/use-cases/production-use-cases";
import { GetSaleUseCase, ListSalesUseCase } from "../application/use-cases/sale-use-cases";
import { ListInventoryMovementsUseCase } from "../application/use-cases/inventory-movement-use-cases";
import { LeatherConsumptionReportUseCase, ProductionReportUseCase, SalesReportUseCase } from "../application/use-cases/report-use-cases";

export class ErpController {
  private readonly listMaterialsUseCase: ListMaterialsUseCase;
  private readonly getMaterialUseCase: GetMaterialUseCase;
  private readonly createMaterialUseCase: CreateMaterialUseCase;
  private readonly updateMaterialUseCase: UpdateMaterialUseCase;
  private readonly deleteMaterialUseCase: DeleteMaterialUseCase;
  private readonly adjustMaterialStockUseCase: AdjustMaterialStockUseCase;

  private readonly listProductsUseCase: ListProductsUseCase;
  private readonly getProductUseCase: GetProductUseCase;
  private readonly createProductUseCase: CreateProductUseCase;
  private readonly updateProductUseCase: UpdateProductUseCase;
  private readonly deleteProductUseCase: DeleteProductUseCase;

  private readonly listProductionOrdersUseCase: ListProductionOrdersUseCase;
  private readonly getProductionOrderUseCase: GetProductionOrderUseCase;
  private readonly createProductionOrderUseCase: CreateProductionOrderUseCase;
  private readonly completeProductionUseCase: CompleteProductionUseCase;

  private readonly listSalesUseCase: ListSalesUseCase;
  private readonly getSaleUseCase: GetSaleUseCase;
  private readonly createSaleUseCase: CreateSaleUseCase;

  private readonly listInventoryMovementsUseCase: ListInventoryMovementsUseCase;

  private readonly productionReportUseCase: ProductionReportUseCase;
  private readonly leatherConsumptionReportUseCase: LeatherConsumptionReportUseCase;
  private readonly salesReportUseCase: SalesReportUseCase;

  constructor(private readonly repository: IErpRepository) {
    this.listMaterialsUseCase = new ListMaterialsUseCase(repository);
    this.getMaterialUseCase = new GetMaterialUseCase(repository);
    this.createMaterialUseCase = new CreateMaterialUseCase(repository);
    this.updateMaterialUseCase = new UpdateMaterialUseCase(repository);
    this.deleteMaterialUseCase = new DeleteMaterialUseCase(repository);
    this.adjustMaterialStockUseCase = new AdjustMaterialStockUseCase(repository);

    this.listProductsUseCase = new ListProductsUseCase(repository);
    this.getProductUseCase = new GetProductUseCase(repository);
    this.createProductUseCase = new CreateProductUseCase(repository);
    this.updateProductUseCase = new UpdateProductUseCase(repository);
    this.deleteProductUseCase = new DeleteProductUseCase(repository);

    this.listProductionOrdersUseCase = new ListProductionOrdersUseCase(repository);
    this.getProductionOrderUseCase = new GetProductionOrderUseCase(repository);
    this.createProductionOrderUseCase = new CreateProductionOrderUseCase(repository);
    this.completeProductionUseCase = new CompleteProductionUseCase(repository);

    this.listSalesUseCase = new ListSalesUseCase(repository);
    this.getSaleUseCase = new GetSaleUseCase(repository);
    this.createSaleUseCase = new CreateSaleUseCase(repository);

    this.listInventoryMovementsUseCase = new ListInventoryMovementsUseCase(repository);

    this.productionReportUseCase = new ProductionReportUseCase(repository);
    this.leatherConsumptionReportUseCase = new LeatherConsumptionReportUseCase(repository);
    this.salesReportUseCase = new SalesReportUseCase(repository);
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
    const consumptions = await this.repository.getProductionVariableConsumptions(order.id);
    res.json({ ...order, consumptions });
  }

  async createProductionOrder(req: Request, res: Response): Promise<void> {
    const input = api.productionOrders.create.input.parse(req.body);
    res.status(201).json(await this.createProductionOrderUseCase.execute(input));
  }

  async concludeProductionOrder(req: Request, res: Response): Promise<void> {
    const input = api.productionOrders.conclude.input.parse(req.body);
    await this.completeProductionUseCase.execute(Number(req.params.id), input);
    res.json(await this.getProductionOrderUseCase.execute(Number(req.params.id)));
  }

  async listSales(_req: Request, res: Response): Promise<void> {
    res.json(await this.listSalesUseCase.execute());
  }

  async getSale(req: Request, res: Response): Promise<void> {
    res.json(await this.getSaleUseCase.execute(Number(req.params.id)));
  }

  async createSale(req: Request, res: Response): Promise<void> {
    const input = api.sales.create.input.parse(req.body);
    const result = await this.createSaleUseCase.execute(input);
    res.status(201).json(await this.getSaleUseCase.execute(result.saleId));
  }

  async listInventoryMovements(_req: Request, res: Response): Promise<void> {
    res.json(await this.listInventoryMovementsUseCase.execute());
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
}

export function handleControllerError(err: unknown, res: Response): void {
  if (err instanceof z.ZodError) {
    res.status(400).json({ message: err.errors[0]?.message ?? "Validation error", field: err.errors[0]?.path.join(".") });
    return;
  }

  if (err instanceof DomainError) {
    res.status(err.statusCode).json({ message: err.message, code: err.code });
    return;
  }

  if (err instanceof Error) {
    res.status(500).json({ message: err.message });
    return;
  }

  res.status(500).json({ message: "Internal server error" });
}
