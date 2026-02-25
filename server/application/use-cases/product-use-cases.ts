import type { BomItemInput, CreateProductInput, ProductWithBom, UpdateProductInput } from "@shared/schema";
import type { IErpRepository } from "../contracts/erp-repository";
import { ConflictDomainError, NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error";

function assertValidBomItems(items: BomItemInput[]): void {
  const seenFixedMaterial = new Set<number>();

  for (const item of items) {
    if (item.itemType === "FIXED_MATERIAL") {
      if (Number(item.qtyPerUnit) <= 0) throw new ValidationDomainError("FIXED_MATERIAL qtyPerUnit must be greater than zero");
      if (seenFixedMaterial.has(item.materialId)) {
        throw new ValidationDomainError("Duplicated fixed material in BOM is not allowed");
      }
      seenFixedMaterial.add(item.materialId);
    }

    if (item.itemType === "VARIABLE_MATERIAL") {
      if (Number(item.plannedQtyPerUnit) <= 0) {
        throw new ValidationDomainError("VARIABLE_MATERIAL plannedQtyPerUnit must be greater than zero");
      }
    }
  }
}

export class ListProductsUseCase {
  constructor(private readonly repository: IErpRepository) {}

  execute(): Promise<ProductWithBom[]> {
    return this.repository.getProducts();
  }
}

export class GetProductUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number): Promise<ProductWithBom> {
    const product = await this.repository.getProduct(id);
    if (!product) throw new NotFoundDomainError("Product not found");
    return product;
  }
}

export class CreateProductUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(input: CreateProductInput): Promise<ProductWithBom> {
    const name = input.product.name.trim();
    if (!name) throw new ValidationDomainError("Product name is required");

    if (Number(input.product.price) < 0) {
      throw new ValidationDomainError("Product price must be greater than or equal to zero");
    }

    const existing = await this.repository.getProductByName(name);
    if (existing) throw new ConflictDomainError("Product name must be unique");

    const bomItems = input.bomItems ?? [];
    assertValidBomItems(bomItems);

    for (const item of bomItems) {
      if (item.itemType === "FIXED_MATERIAL") {
        const material = await this.repository.getMaterial(item.materialId);
        if (!material) throw new ValidationDomainError(`Material ${item.materialId} not found for FIXED_MATERIAL item`);
      }
    }

    return this.repository.withTransaction(async (txRepository) => {
      const created = await txRepository.createProduct({
        name,
        price: input.product.price,
        isActive: input.product.isActive,
      });

      await txRepository.replaceActiveBom(created.id, bomItems);

      const product = await txRepository.getProduct(created.id);
      if (!product) throw new NotFoundDomainError("Product not found after creation");
      return product;
    });
  }
}

export class UpdateProductUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number, input: UpdateProductInput): Promise<ProductWithBom> {
    const product = await this.repository.getProduct(id);
    if (!product) throw new NotFoundDomainError("Product not found");

    if (input.product.name !== undefined) {
      const nextName = input.product.name.trim();
      if (!nextName) throw new ValidationDomainError("Product name is required");
      if (nextName !== product.name) {
        const existing = await this.repository.getProductByName(nextName);
        if (existing && existing.id !== id) throw new ConflictDomainError("Product name must be unique");
      }
      input.product.name = nextName;
    }

    if (input.product.price !== undefined && Number(input.product.price) < 0) {
      throw new ValidationDomainError("Product price must be greater than or equal to zero");
    }

    if (input.bomItems) {
      assertValidBomItems(input.bomItems);
      for (const item of input.bomItems) {
        if (item.itemType === "FIXED_MATERIAL") {
          const material = await this.repository.getMaterial(item.materialId);
          if (!material) throw new ValidationDomainError(`Material ${item.materialId} not found for FIXED_MATERIAL item`);
        }
      }
    }

    return this.repository.withTransaction(async (txRepository) => {
      if (Object.keys(input.product).length > 0) {
        await txRepository.updateProductBase(id, input.product);
      }

      if (input.bomItems) {
        await txRepository.replaceActiveBom(id, input.bomItems);
      }

      const updated = await txRepository.getProduct(id);
      if (!updated) throw new NotFoundDomainError("Product not found after update");
      return updated;
    });
  }
}

export class DeleteProductUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number): Promise<void> {
    const product = await this.repository.getProduct(id);
    if (!product) throw new NotFoundDomainError("Product not found");
    await this.repository.deactivateProduct(id);
  }
}
