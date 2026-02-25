import type { InsertInventoryMovement } from "@shared/schema";

export type MovementEntityType = "PRODUCT" | "MATERIAL" | "MATERIAL_GROUP";
export type MovementDirection = "IN" | "OUT";
export type MovementReason = "PRODUCTION_CONSUMPTION" | "PRODUCTION_OUTPUT" | "SALE" | "PURCHASE" | "ADJUSTMENT";
export type MovementReferenceType = "OP" | "SALE" | "MANUAL";

export interface InventoryMovementProps {
  entityType: MovementEntityType;
  entityId?: number;
  group?: "LEATHER" | "HARDWARE" | "ADHESIVE" | "THREAD" | "OTHER";
  direction: MovementDirection;
  qty: number;
  reason: MovementReason;
  referenceType: MovementReferenceType;
  referenceId?: number;
  metadata?: Record<string, unknown>;
}

export class InventoryMovement {
  private constructor(private readonly props: InventoryMovementProps) {}

  static create(props: InventoryMovementProps): InventoryMovement {
    return new InventoryMovement(props);
  }

  toPersistence(): InsertInventoryMovement {
    return {
      entityType: this.props.entityType,
      entityId: this.props.entityId ?? null,
      group: this.props.group ?? null,
      direction: this.props.direction,
      qty: this.props.qty.toFixed(3),
      reason: this.props.reason,
      referenceType: this.props.referenceType,
      referenceId: this.props.referenceId ?? null,
      metadata: this.props.metadata ?? null,
    };
  }
}
