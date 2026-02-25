import { InvalidOperationDomainError, ValidationDomainError } from "../errors/domain-error";
import { TechnicalSpecItem } from "./technical-spec-item";

export interface ProductProps {
  id: number;
  name: string;
  price: number;
  stockQty: number;
  isActive: boolean;
}

export class Product {
  private bomItems: TechnicalSpecItem[] = [];

  constructor(private readonly props: ProductProps) {
    if (!props.name.trim()) throw new ValidationDomainError("Product name is required");
    if (props.price < 0) throw new ValidationDomainError("Product price must be greater than or equal to zero");
    if (props.stockQty < 0) throw new ValidationDomainError("Product stock cannot be negative");
  }

  get id(): number {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get price(): number {
    return this.props.price;
  }

  setBomItems(items: TechnicalSpecItem[]): void {
    this.bomItems = items;
  }

  get specs(): TechnicalSpecItem[] {
    return this.bomItems;
  }

  increaseStock(qty: number): void {
    if (qty <= 0) throw new ValidationDomainError("Increase stock quantity must be greater than zero");
    this.props.stockQty += qty;
  }

  decreaseStock(qty: number): void {
    if (qty <= 0) throw new ValidationDomainError("Decrease stock quantity must be greater than zero");
    if (this.props.stockQty - qty < 0) {
      throw new InvalidOperationDomainError(`Insufficient stock for product ${this.props.name}`);
    }
    this.props.stockQty -= qty;
  }

  toPersistence(): { stockQty: number } {
    return { stockQty: this.props.stockQty };
  }
}
