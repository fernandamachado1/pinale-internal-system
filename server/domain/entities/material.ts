import { InvalidOperationDomainError, ValidationDomainError } from "../errors/domain-error.ts";

export type MaterialCategory = "PACKAGING" | "NOTIONS" | "RAW_MATERIAL";
export type UnitOfMeasure = "UNIT" | "SQUARE_METER" | "METER";

export interface MaterialProps {
  id: number;
  name: string;
  unitOfMeasure: UnitOfMeasure;
  stockTracked: boolean;
  stockQty: number;
  reservedQty: number;
  category: MaterialCategory;
  purchasePrice: number;
  pricePerSquareMeter?: number | null;
  isActive: boolean;
}

export class Material {
  constructor(private readonly props: MaterialProps) {
    if (!props.name.trim()) throw new ValidationDomainError("Material name is required");
    if (props.stockQty < 0) throw new ValidationDomainError("Material stock quantity cannot be negative");
    if (props.reservedQty < 0) throw new ValidationDomainError("Material reserved quantity cannot be negative");
    if (props.reservedQty > props.stockQty) throw new ValidationDomainError("Material reserved quantity cannot exceed stock");
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

  get stockTracked(): boolean {
    return this.props.stockTracked;
  }

  private ensureStockTracked(): void {
    if (!this.props.stockTracked) {
      throw new InvalidOperationDomainError(`Material ${this.props.name} does not use stock control`);
    }
  }

  reserve(quantity: number): void {
    this.ensureStockTracked();
    if (quantity <= 0) throw new ValidationDomainError("Reservation quantity must be greater than zero");
    const available = this.props.stockQty - this.props.reservedQty;
    if (available - quantity < 0) {
      throw new InvalidOperationDomainError(
        `Insufficient available stock for material ${this.props.name} (needed ${quantity.toFixed(3)}, available ${available.toFixed(3)})`,
      );
    }
    this.props.reservedQty += quantity;
  }

  releaseReservation(quantity: number): void {
    this.ensureStockTracked();
    if (quantity <= 0) throw new ValidationDomainError("Release quantity must be greater than zero");
    if (this.props.reservedQty - quantity < 0) {
      throw new InvalidOperationDomainError(`Insufficient reserved stock for material ${this.props.name}`);
    }
    this.props.reservedQty -= quantity;
  }

  consumeReserved(quantity: number): void {
    this.ensureStockTracked();
    if (quantity <= 0) throw new ValidationDomainError("Consumption quantity must be greater than zero");
    if (this.props.reservedQty - quantity < 0) {
      throw new InvalidOperationDomainError(`Insufficient reserved stock for material ${this.props.name}`);
    }
    const nextStock = this.props.stockQty - quantity;
    if (nextStock < 0) {
      throw new InvalidOperationDomainError(`Insufficient stock for material ${this.props.name}`);
    }
    this.props.reservedQty -= quantity;
    this.props.stockQty = nextStock;
  }

  consumeStock(quantity: number): void {
    this.ensureStockTracked();
    if (quantity <= 0) throw new ValidationDomainError("Consumption quantity must be greater than zero");

    const next = this.props.stockQty - quantity;
    if (next < 0) {
      throw new InvalidOperationDomainError(`Insufficient stock for material ${this.props.name}`);
    }
    this.props.stockQty = next;
  }

  addStock(quantity: number): void {
    this.ensureStockTracked();
    if (quantity <= 0) throw new ValidationDomainError("Inbound quantity must be greater than zero");
    this.props.stockQty += quantity;
  }

  adjustStock(delta: number): void {
    this.ensureStockTracked();
    const next = this.props.stockQty + delta;
    if (next < 0) {
      throw new InvalidOperationDomainError(`Insufficient stock for material ${this.props.name}`);
    }
    if (next < this.props.reservedQty) {
      throw new InvalidOperationDomainError(`Cannot reduce stock below reserved quantity for material ${this.props.name}`);
    }
    this.props.stockQty = next;
  }

  toPersistence(): { stockQty: string; reservedQty: string } {
    return {
      stockQty: this.props.stockQty.toFixed(3),
      reservedQty: this.props.reservedQty.toFixed(3),
    };
  }
}
