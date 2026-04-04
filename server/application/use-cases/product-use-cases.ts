import type { BomItemInput, CreateProductInput, ProductWithBom, UpdateProductInput } from "@shared/schema.ts";
import type { IErpRepository } from "../contracts/erp-repository.ts";
import { ConflictDomainError, NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error.ts";

function assertValidBomItems(items: BomItemInput[]): void {
  const seenFixedMaterial = new Set<number>();

  for (const item of items) {
    if (Number(item.qtyPerUnit) <= 0) throw new ValidationDomainError("qtyPerUnit must be greater than zero");
    if (seenFixedMaterial.has(item.materialId)) {
      throw new ValidationDomainError("Duplicated fixed material in BOM is not allowed");
    }
    seenFixedMaterial.add(item.materialId);
  }
}

function assertValidTechnicalSpec(input: { bomItems?: BomItemInput[] }): void {
  if (input.bomItems) {
    assertValidBomItems(input.bomItems);
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

    assertValidTechnicalSpec(input.technicalSpec);

    for (const item of input.technicalSpec.bomItems ?? []) {
      const material = await this.repository.getMaterial(item.materialId);
      if (!material) throw new ValidationDomainError(`Material ${item.materialId} not found for BOM item`);
    }

    return this.repository.withTransaction(async (txRepository) => {
      const created = await txRepository.createProduct({
        name,
        price: input.product.price,
        isActive: input.product.isActive,
      });

      await txRepository.replaceActiveBom(created.id, {
        bomItems: input.technicalSpec.bomItems ?? [],
      });
      await txRepository.createProducedProductStock(created.id);

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

    if (input.technicalSpec) {
      assertValidTechnicalSpec(input.technicalSpec);
      for (const item of input.technicalSpec.bomItems ?? []) {
        const material = await this.repository.getMaterial(item.materialId);
        if (!material) throw new ValidationDomainError(`Material ${item.materialId} not found for BOM item`);
      }
    }

    return this.repository.withTransaction(async (txRepository) => {
      if (Object.keys(input.product).length > 0) {
        await txRepository.updateProductBase(id, input.product);
      }

      if (input.technicalSpec) {
        const currentBom = await txRepository.getActiveBomByProductId(id);
        if (!currentBom) throw new ValidationDomainError("Product must have one active BOM");

        await txRepository.replaceActiveBom(id, {
          bomItems: input.technicalSpec.bomItems ?? currentBom.items.map((item) => ({ materialId: item.materialId!, qtyPerUnit: String(item.qtyPerUnit) })),
        });
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
