import type {
  CreatePurchaseOrderInput,
  ReceivePurchaseOrderInput,
  PurchaseOrderItem,
  PurchaseOrderWithItems,
  ReorderPurchaseOrdersInput,
  UpdatePurchaseOrderInput,
} from "@shared/schema.ts";
import type { IErpRepository } from "../contracts/erp-repository.ts";
import { Material } from "../../domain/entities/material.ts";
import { InventoryMovement } from "../../domain/entities/inventory-movement.ts";
import {
  InvalidOperationDomainError,
  NotFoundDomainError,
  ValidationDomainError,
} from "../../domain/errors/domain-error.ts";

function toQty3(value: number): string {
  return value.toFixed(3);
}

async function resolveMaterialName(repository: IErpRepository, materialId: number): Promise<string> {
  const material = await repository.getMaterial(materialId);
  if (!material) throw new ValidationDomainError(`Material ${materialId} not found`);
  return material.name;
}

function assertPositiveQty(label: string, raw: string): number {
  const qty = Number(raw);
  if (!Number.isFinite(qty) || qty <= 0) throw new ValidationDomainError(`${label} must be greater than zero`);
  return qty;
}

function parseOptionalNonNegativeQty(label: string, raw: string | undefined): number {
  if (raw === undefined) return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const qty = Number(trimmed);
  if (!Number.isFinite(qty) || qty < 0) throw new ValidationDomainError(`${label} must be a non-negative number`);
  return qty;
}

function computeStatus(order: PurchaseOrderWithItems): "OPEN" | "PARTIALLY_RECEIVED" | "RECEIVED" {
  const anyReceived = order.items.some((item) => Number(item.qtyReceived) > 0);
  const allHaveOrderedQty = order.items.length > 0 && order.items.every((item) => Number(item.qtyOrdered) > 0);
  const allReceived =
    allHaveOrderedQty && order.items.every((item) => Number(item.qtyReceived) >= Number(item.qtyOrdered));
  if (allReceived) return "RECEIVED";
  if (anyReceived) return "PARTIALLY_RECEIVED";
  return "OPEN";
}

export class ListPurchaseOrdersUseCase {
  constructor(private readonly repository: IErpRepository) {}
  async execute(): Promise<PurchaseOrderWithItems[]> {
    return await this.repository.withTransaction(async (tx) => {
      await tx.splitOpenPurchaseOrdersIntoSingleItemOrders();
      return await tx.getPurchaseOrders();
    });
  }
}

export class ReorderPurchaseOrdersUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(input: ReorderPurchaseOrdersInput): Promise<void> {
    await this.repository.withTransaction(async (tx) => {
      await tx.reorderPurchaseOrders(input);
    });
  }
}

export class GetPurchaseOrderUseCase {
  constructor(private readonly repository: IErpRepository) {}
  async execute(id: number): Promise<PurchaseOrderWithItems> {
    const order = await this.repository.getPurchaseOrder(id);
    if (!order) throw new NotFoundDomainError("Purchase order not found");
    return order;
  }
}

export class CreatePurchaseOrderUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(input: CreatePurchaseOrderInput): Promise<PurchaseOrderWithItems> {
    return this.repository.withTransaction(async (tx) => {
      const order = await tx.createPurchaseOrderBase();

      const items = await Promise.all(
        input.items.map(async (item, index) => {
          const qtyOrdered = parseOptionalNonNegativeQty("qtyOrdered", item.qtyOrdered);
          const materialName = item.materialId
            ? await resolveMaterialName(tx, item.materialId)
            : item.materialName.trim();
          if (!materialName) throw new ValidationDomainError("materialName is required");

          return {
            materialId: item.materialId ?? null,
            materialName,
            description: item.description?.trim() ? item.description.trim() : null,
            qtyOrdered: toQty3(qtyOrdered),
            qtyReceived: "0.000",
            sortOrder: index,
          } satisfies Pick<PurchaseOrderItem, "materialId" | "materialName" | "description" | "qtyOrdered" | "qtyReceived" | "sortOrder">;
        }),
      );

      await tx.createPurchaseOrderItems(order.id, items);

      const created = await tx.getPurchaseOrder(order.id);
      if (!created) throw new NotFoundDomainError("Purchase order not found after creation");
      return created;
    });
  }
}

export class UpdatePurchaseOrderUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number, input: UpdatePurchaseOrderInput): Promise<PurchaseOrderWithItems> {
    return this.repository.withTransaction(async (tx) => {
      const current = await tx.getPurchaseOrder(id);
      if (!current) throw new NotFoundDomainError("Purchase order not found");
      if (current.status === "RECEIVED") throw new InvalidOperationDomainError("Purchase order already received");
      if (current.status === "CANCELED") throw new InvalidOperationDomainError("Purchase order is canceled");

      const existingById = new Map(current.items.map((item) => [item.id, item]));
      const seenIds = new Set<number>();

      for (let index = 0; index < input.items.length; index += 1) {
        const item = input.items[index];
        const qtyOrdered = parseOptionalNonNegativeQty("qtyOrdered", item.qtyOrdered);
        const nextQtyOrdered = toQty3(qtyOrdered);

        const materialName = item.materialId
          ? await resolveMaterialName(tx, item.materialId)
          : item.materialName.trim();
        if (!materialName) throw new ValidationDomainError("materialName is required");

        if (item.id) {
          const existing = existingById.get(item.id);
          if (!existing) throw new ValidationDomainError(`Purchase order item ${item.id} not found`);
          seenIds.add(item.id);

          if (Number(nextQtyOrdered) < Number(existing.qtyReceived)) {
            throw new ValidationDomainError("qtyOrdered cannot be less than qtyReceived");
          }

          await tx.updatePurchaseOrderItem(item.id, {
            materialId: item.materialId ?? null,
            materialName,
            description: item.description?.trim() ? item.description.trim() : null,
            qtyOrdered: nextQtyOrdered,
            sortOrder: index,
          });
          continue;
        }

        await tx.createPurchaseOrderItems(id, [
          {
            materialId: item.materialId ?? null,
            materialName,
            description: item.description?.trim() ? item.description.trim() : null,
            qtyOrdered: nextQtyOrdered,
            qtyReceived: "0.000",
            sortOrder: index,
          },
        ]);
      }

      for (const existing of current.items) {
        if (seenIds.has(existing.id)) continue;
        if (Number(existing.qtyReceived) > 0) {
          throw new InvalidOperationDomainError("Cannot remove items that have already been received");
        }
        await tx.deletePurchaseOrderItem(existing.id);
      }

      await tx.updatePurchaseOrderBase(id, {});

      const updated = await tx.getPurchaseOrder(id);
      if (!updated) throw new NotFoundDomainError("Purchase order not found after update");
      return updated;
    });
  }
}

export class ReceivePurchaseOrderUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number, input: ReceivePurchaseOrderInput): Promise<PurchaseOrderWithItems> {
    return this.repository.withTransaction(async (tx) => {
      const current = await tx.getPurchaseOrder(id);
      if (!current) throw new NotFoundDomainError("Purchase order not found");
      if (current.status === "RECEIVED") throw new InvalidOperationDomainError("Purchase order already received");
      if (current.status === "CANCELED") throw new InvalidOperationDomainError("Purchase order is canceled");

      const itemsById = new Map(current.items.map((item) => [item.id, item]));

      for (const receiveLine of input.items) {
        const item = itemsById.get(receiveLine.id);
        if (!item) throw new ValidationDomainError(`Purchase order item ${receiveLine.id} not found`);

        const qtyNow = assertPositiveQty("qtyReceiveNow", receiveLine.qtyReceiveNow);
        const nextQtyOrderedValue = parseOptionalNonNegativeQty("qtyOrdered", receiveLine.qtyOrdered);
        const effectiveQtyOrdered = receiveLine.qtyOrdered === undefined ? Number(item.qtyOrdered) : nextQtyOrderedValue;
        if (effectiveQtyOrdered > 0 && effectiveQtyOrdered < Number(item.qtyReceived)) {
          throw new ValidationDomainError("qtyOrdered cannot be less than qtyReceived");
        }
        if (effectiveQtyOrdered > 0) {
          const remaining = effectiveQtyOrdered - Number(item.qtyReceived);
          if (qtyNow > remaining) throw new ValidationDomainError("qtyReceiveNow cannot exceed remaining quantity");
        }

        let materialId = item.materialId ?? null;
        let materialName = (receiveLine.materialName?.trim() ? receiveLine.materialName.trim() : item.materialName).trim();
        if (!materialName) throw new ValidationDomainError("materialName is required");

        if (receiveLine.materialId) {
          materialName = await resolveMaterialName(tx, receiveLine.materialId);
          materialId = receiveLine.materialId;
        }

        const nextQtyReceived = toQty3(Number(item.qtyReceived) + qtyNow);

        await tx.updatePurchaseOrderItem(item.id, {
          materialId,
          materialName,
          ...(receiveLine.qtyOrdered !== undefined ? { qtyOrdered: toQty3(nextQtyOrderedValue) } : {}),
          qtyReceived: nextQtyReceived,
        });

        if (materialId) {
          const materialRecord = await tx.getMaterial(materialId);
          if (!materialRecord) throw new ValidationDomainError(`Material ${materialId} not found`);

          const material = new Material({
            id: materialRecord.id,
            name: materialRecord.name,
            unitOfMeasure: materialRecord.unitOfMeasure,
            stockTracked: materialRecord.stockTracked !== false,
            stockQty: Number(materialRecord.stockQty),
            reservedQty: Number(materialRecord.reservedQty ?? 0),
            category: materialRecord.category,
            purchasePrice: Number(materialRecord.purchasePrice),
            pricePerSquareMeter: materialRecord.pricePerSquareMeter ? Number(materialRecord.pricePerSquareMeter) : null,
            isActive: materialRecord.isActive === 1,
          });

          if (material.stockTracked) {
            material.addStock(qtyNow);
            await tx.updateMaterialStockQty(material.id, material.toPersistence().stockQty);

            const movement = InventoryMovement.create({
              entityType: "MATERIAL",
              entityId: material.id,
              direction: "IN",
              qty: qtyNow,
              reason: "PURCHASE",
              referenceType: "MANUAL",
              metadata: {
                purchaseOrderId: id,
                purchaseOrderItemId: item.id,
              },
            });
            await tx.createInventoryMovement(movement.toData());
          }
        }
      }

      const afterItemsUpdate = await tx.getPurchaseOrder(id);
      if (!afterItemsUpdate) throw new NotFoundDomainError("Purchase order not found after receive");

      const nextStatus = computeStatus(afterItemsUpdate);
      await tx.updatePurchaseOrderBase(id, {
        status: nextStatus,
        receivedAt: nextStatus === "RECEIVED" ? new Date() : null,
      });

      const updated = await tx.getPurchaseOrder(id);
      if (!updated) throw new NotFoundDomainError("Purchase order not found after receive");
      return updated;
    });
  }
}

export class CancelPurchaseOrderUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number): Promise<void> {
    await this.repository.withTransaction(async (tx) => {
      const current = await tx.getPurchaseOrder(id);
      if (!current) throw new NotFoundDomainError("Purchase order not found");
      if (current.status === "RECEIVED") throw new InvalidOperationDomainError("Cannot cancel a received purchase order");

      await tx.updatePurchaseOrderBase(id, { status: "CANCELED", isActive: 0 });
    });
  }
}
