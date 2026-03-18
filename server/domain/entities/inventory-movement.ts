export type MovementEntityType = "PRODUCT" | "MATERIAL";
export type MovementDirection = "IN" | "OUT";
export type MovementReason = "PRODUCTION_CONSUMPTION" | "PRODUCTION_OUTPUT" | "SALE" | "PURCHASE" | "ADJUSTMENT";
export type MovementReferenceType = "OP" | "SALE" | "MANUAL";

export interface InventoryMovementProps {
  entityType: MovementEntityType;
  entityId?: number;
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

  toData(): InventoryMovementProps {
    return {
      entityType: this.props.entityType,
      entityId: this.props.entityId,
      direction: this.props.direction,
      qty: this.props.qty,
      reason: this.props.reason,
      referenceType: this.props.referenceType,
      referenceId: this.props.referenceId,
      metadata: this.props.metadata,
    };
  }
}
