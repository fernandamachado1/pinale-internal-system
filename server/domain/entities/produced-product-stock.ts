import { InvalidOperationDomainError, ValidationDomainError } from "../errors/domain-error.ts";

export interface ProducedProductStockProps {
  productId: number;
  stockQty: number;
}

export class ProducedProductStock {
  constructor(private readonly props: ProducedProductStockProps) {
    if (props.stockQty < 0) throw new ValidationDomainError("Produced product stock cannot be negative");
  }

  get productId(): number {
    return this.props.productId;
  }

  increase(qty: number): void {
    if (qty <= 0) throw new ValidationDomainError("Increase stock quantity must be greater than zero");
    this.props.stockQty += qty;
  }

  decrease(qty: number): void {
    if (qty <= 0) throw new ValidationDomainError("Decrease stock quantity must be greater than zero");
    if (this.props.stockQty - qty < 0) {
      throw new InvalidOperationDomainError(`Insufficient produced stock for product ${this.props.productId}`);
    }
    this.props.stockQty -= qty;
  }

  toPersistence(): { stockQty: number } {
    return { stockQty: this.props.stockQty };
  }
}
