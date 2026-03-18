import { ValidationDomainError } from "../errors/domain-error";

export interface TechnicalSpecItemProps {
  materialId: number;
  qtyPerUnit: number;
}

export class TechnicalSpecItem {
  constructor(private readonly props: TechnicalSpecItemProps) {
    if (this.props.qtyPerUnit <= 0) throw new ValidationDomainError("qtyPerUnit must be greater than zero");
  }

  get materialId(): number {
    return this.props.materialId;
  }

  calculateFixedConsumption(productionQuantity: number): number {
    return this.props.qtyPerUnit * productionQuantity;
  }
}
