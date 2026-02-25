import { InvalidOperationDomainError, ValidationDomainError } from "../errors/domain-error";

export type MaterialPolicy = "STOCK_CONTROLLED" | "CONSUMPTION_TRACKED";
export type MaterialGroup = "LEATHER" | "HARDWARE" | "ADHESIVE" | "THREAD" | "OTHER";

export interface MaterialProps {
  id: number;
  name: string;
  unit: string;
  policy: MaterialPolicy;
  stockQty: number | null;
  group: MaterialGroup;
  isActive: boolean;
}

export class Material {
  constructor(private readonly props: MaterialProps) {
    if (!props.name.trim()) throw new ValidationDomainError("Material name is required");
    if (!props.unit.trim()) throw new ValidationDomainError("Material unit is required");
    if (props.policy === "STOCK_CONTROLLED" && props.stockQty === null) {
      throw new ValidationDomainError("STOCK_CONTROLLED material must have stock quantity");
    }
    if (props.policy === "CONSUMPTION_TRACKED" && props.stockQty !== null) {
      throw new ValidationDomainError("CONSUMPTION_TRACKED material cannot have stock quantity");
    }
  }

  get id(): number {
    return this.props.id;
  }

  get policy(): MaterialPolicy {
    return this.props.policy;
  }

  get group(): MaterialGroup {
    return this.props.group;
  }

  consumeStock(quantity: number): void {
    if (quantity <= 0) throw new ValidationDomainError("Consumption quantity must be greater than zero");
    if (this.props.policy !== "STOCK_CONTROLLED") return;

    const current = this.props.stockQty ?? 0;
    const next = current - quantity;
    if (next < 0) {
      throw new InvalidOperationDomainError(`Insufficient stock for material ${this.props.name}`);
    }
    this.props.stockQty = next;
  }

  addStock(quantity: number): void {
    if (quantity <= 0) throw new ValidationDomainError("Inbound quantity must be greater than zero");
    if (this.props.policy !== "STOCK_CONTROLLED") return;

    this.props.stockQty = (this.props.stockQty ?? 0) + quantity;
  }

  adjustStock(delta: number): void {
    if (this.props.policy !== "STOCK_CONTROLLED") {
      throw new InvalidOperationDomainError("Cannot adjust stock for CONSUMPTION_TRACKED material");
    }

    const current = this.props.stockQty ?? 0;
    const next = current + delta;
    if (next < 0) {
      throw new InvalidOperationDomainError(`Insufficient stock for material ${this.props.name}`);
    }
    this.props.stockQty = next;
  }

  toPersistence(): { stockQty: string | null } {
    return {
      stockQty: this.props.stockQty === null ? null : this.props.stockQty.toFixed(3),
    };
  }
}
