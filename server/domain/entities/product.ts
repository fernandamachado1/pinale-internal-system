import { ValidationDomainError } from "../errors/domain-error";
import { TechnicalSpecItem } from "./technical-spec-item";

export interface ProductProps {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
}

export class Product {
  private bomItems: TechnicalSpecItem[] = [];

  constructor(private readonly props: ProductProps) {
    if (!props.name.trim()) throw new ValidationDomainError("Product name is required");
    if (props.price < 0) throw new ValidationDomainError("Product price must be greater than or equal to zero");
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
}
