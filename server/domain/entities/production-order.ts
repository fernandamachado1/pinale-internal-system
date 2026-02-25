import { InvalidOperationDomainError, ValidationDomainError } from "../errors/domain-error";

export type ProductionOrderStatus = "OPEN" | "DONE";

export interface ProductionOrderProps {
  id: number;
  productId: number;
  qtyPlanned: number;
  status: ProductionOrderStatus;
  createdAt: Date;
  completedAt?: Date | null;
}

export class ProductionOrder {
  private status: ProductionOrderStatus;
  private completedAt: Date | null;

  constructor(private readonly props: ProductionOrderProps) {
    if (props.qtyPlanned <= 0) throw new ValidationDomainError("qtyPlanned must be greater than zero");
    this.status = props.status;
    this.completedAt = props.completedAt ?? null;
  }

  static open(productId: number, qtyPlanned: number): ProductionOrder {
    return new ProductionOrder({
      id: 0,
      productId,
      qtyPlanned,
      status: "OPEN",
      createdAt: new Date(),
      completedAt: null,
    });
  }

  get id(): number {
    return this.props.id;
  }

  get qtyPlanned(): number {
    return this.props.qtyPlanned;
  }

  ensureOpen(): void {
    if (this.status !== "OPEN") {
      throw new InvalidOperationDomainError("Production order must be OPEN before concluding");
    }
  }

  markDone(): Date {
    this.ensureOpen();
    this.status = "DONE";
    this.completedAt = new Date();
    return this.completedAt;
  }
}
