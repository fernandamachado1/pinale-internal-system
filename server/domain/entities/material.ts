import { InvalidOperationDomainError, ValidationDomainError } from "../errors/domain-error";

export type MaterialCategory = "PACKAGING" | "NOTIONS" | "RAW_MATERIAL";
export type UnitOfMeasure = "UNIT" | "SQUARE_METER" | "METER";

export interface MaterialProps {
  id: number;
  name: string;
  unitOfMeasure: UnitOfMeasure;
  stockQty: number;
  category: MaterialCategory;
  purchasePrice: number;
  pricePerSquareMeter?: number | null;
  isActive: boolean;
}

export class Material {
  constructor(private readonly props: MaterialProps) {
    if (!props.name.trim()) throw new ValidationDomainError("Material name is required");
    if (props.stockQty < 0) throw new ValidationDomainError("Material stock quantity cannot be negative");
    if (props.purchasePrice < 0) throw new ValidationDomainError("Material purchase price cannot be negative");
    if (props.category === "RAW_MATERIAL" && (props.pricePerSquareMeter === undefined || props.pricePerSquareMeter === null || props.pricePerSquareMeter < 0)) {
      throw new ValidationDomainError("Raw material must define price per square meter");
    }
  }

  get id(): number {
    return this.props.id;
  }

  get category(): MaterialCategory {
    return this.props.category;
  }

  consumeStock(quantity: number): void {
    if (quantity <= 0) throw new ValidationDomainError("Consumption quantity must be greater than zero");

    const next = this.props.stockQty - quantity;
    if (next < 0) {
      throw new InvalidOperationDomainError(`Insufficient stock for material ${this.props.name}`);
    }
    this.props.stockQty = next;
  }

  addStock(quantity: number): void {
    if (quantity <= 0) throw new ValidationDomainError("Inbound quantity must be greater than zero");
    this.props.stockQty += quantity;
  }

  adjustStock(delta: number): void {
    const next = this.props.stockQty + delta;
    if (next < 0) {
      throw new InvalidOperationDomainError(`Insufficient stock for material ${this.props.name}`);
    }
    this.props.stockQty = next;
  }

  toPersistence(): { stockQty: string } {
    return {
      stockQty: this.props.stockQty.toFixed(3),
    };
  }
}
