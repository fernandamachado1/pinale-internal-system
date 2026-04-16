import type { BomItemInput, CatalogProduct, CreateProductInput, ProductColorVariant, ProductWithBom, UpdateProductInput } from "@shared/schema.ts";
import { InventoryMovement } from "../../domain/entities/inventory-movement.ts";
import { ProducedProductStock } from "../../domain/entities/produced-product-stock.ts";
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

function normalizeColorVariants(items?: ProductColorVariant[]): ProductColorVariant[] {
  if (!items) return [];

  const seen = new Set<string>();
  const normalized: ProductColorVariant[] = [];

  for (const item of items) {
    const name = item.name.trim();
    if (!name) continue;
    if (!Number.isInteger(item.qty) || item.qty < 0) {
      throw new ValidationDomainError("Color quantity must be an integer greater than or equal to zero");
    }

    const key = name.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) {
      throw new ValidationDomainError("Duplicated color in product variants is not allowed");
    }
    seen.add(key);
    normalized.push({ name, qty: item.qty });
  }

  return normalized;
}

export class ListProductsUseCase {
  constructor(private readonly repository: IErpRepository) {}

  execute(): Promise<ProductWithBom[]> {
    return this.repository.getProducts();
  }
}

export class ListCatalogProductsUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(input: { q?: string; page: number; pageSize: number }): Promise<{ items: CatalogProduct[]; total: number }> {
    return this.repository.getCatalogProducts(input);
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
    if (!Number.isInteger(input.initialStockQty) || input.initialStockQty < 0) {
      throw new ValidationDomainError("initialStockQty must be an integer greater than or equal to zero");
    }

    const existing = await this.repository.getProductByName(name);
    if (existing) throw new ConflictDomainError("Product name must be unique");

    assertValidTechnicalSpec(input.technicalSpec ?? {});
    const colorVariants = normalizeColorVariants(input.product.colorVariants);

    const bomItems = input.technicalSpec?.bomItems ?? [];
    for (const item of bomItems) {
      const material = await this.repository.getMaterial(item.materialId);
      if (!material) throw new ValidationDomainError(`Material ${item.materialId} not found for BOM item`);
    }

    return this.repository.withTransaction(async (txRepository) => {
      const created = await txRepository.createProduct({
        name,
        price: input.product.price,
        isActive: input.product.isActive,
        description: input.product.description ?? "",
        colorVariants,
      });

      if (bomItems.length > 0) {
        await txRepository.replaceActiveBom(created.id, { bomItems });
      }
      await txRepository.createProducedProductStock(created.id);

      if (input.initialStockQty > 0) {
        const producedStock = new ProducedProductStock({
          productId: created.id,
          stockQty: 0,
        });
        producedStock.increase(input.initialStockQty);
        await txRepository.updateProducedProductStockQty(created.id, producedStock.toPersistence().stockQty);
        await txRepository.createInventoryMovement(
          InventoryMovement.create({
            entityType: "PRODUCT",
            entityId: created.id,
            direction: "IN",
            qty: input.initialStockQty,
            reason: "ADJUSTMENT",
            referenceType: "MANUAL",
            metadata: {
              subtype: "INITIAL_ENTRY",
              source: "PRODUCT_CREATE",
            },
          }).toData(),
        );
      }

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

    if (input.product.colorVariants !== undefined) {
      const colorVariants = normalizeColorVariants(input.product.colorVariants);
      input.product.colorVariants = colorVariants;
    }

    if (input.technicalSpec?.bomItems !== undefined) {
      assertValidTechnicalSpec(input.technicalSpec);
      for (const item of input.technicalSpec.bomItems) {
        const material = await this.repository.getMaterial(item.materialId);
        if (!material) throw new ValidationDomainError(`Material ${item.materialId} not found for BOM item`);
      }
    }

    return this.repository.withTransaction(async (txRepository) => {
      if (Object.keys(input.product).length > 0) {
        await txRepository.updateProductBase(id, input.product);
      }

      if (input.technicalSpec?.bomItems !== undefined) {
        await txRepository.replaceActiveBom(id, {
          bomItems: input.technicalSpec.bomItems,
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
