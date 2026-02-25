import { ValidationDomainError } from "../errors/domain-error";

export interface SaleLine {
  productId: number;
  qty: number;
  unitPrice: number;
}

export class SaleAggregate {
  private readonly items: SaleLine[] = [];

  constructor(public readonly paymentMethod: string) {
    if (!paymentMethod.trim()) throw new ValidationDomainError("paymentMethod is required");
  }

  addItem(productId: number, qty: number, unitPrice: number): void {
    if (qty <= 0) throw new ValidationDomainError("Sale item qty must be greater than zero");
    if (unitPrice < 0) throw new ValidationDomainError("Sale item unit price must be greater than or equal to zero");
    this.items.push({ productId, qty, unitPrice });
  }

  getItems(): SaleLine[] {
    return [...this.items];
  }

  calculateTotalAmount(): number {
    return this.items.reduce((acc, item) => acc + item.qty * item.unitPrice, 0);
  }
}
