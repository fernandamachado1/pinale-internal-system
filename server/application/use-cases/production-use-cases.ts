import type { InsertProductionOrder, ProductionOrderWithProduct } from "@shared/schema";
import type { IErpRepository } from "../contracts/erp-repository";
import { NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error";

export class ListProductionOrdersUseCase {
  constructor(private readonly repository: IErpRepository) {}

  execute(): Promise<ProductionOrderWithProduct[]> {
    return this.repository.getProductionOrders();
  }
}

export class GetProductionOrderUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number): Promise<ProductionOrderWithProduct> {
    const order = await this.repository.getProductionOrder(id);
    if (!order) throw new NotFoundDomainError("Production order not found");
    return order;
  }
}

export class CreateProductionOrderUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(input: InsertProductionOrder): Promise<ProductionOrderWithProduct> {
    if (input.qtyPlanned <= 0) throw new ValidationDomainError("qtyPlanned must be greater than zero");

    const product = await this.repository.getProduct(input.productId);
    if (!product) throw new NotFoundDomainError("Product not found");

    const created = await this.repository.createProductionOrder(input);
    const order = await this.repository.getProductionOrder(created.id);
    if (!order) throw new NotFoundDomainError("Production order not found after creation");
    return order;
  }
}
