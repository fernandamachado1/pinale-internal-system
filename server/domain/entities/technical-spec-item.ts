import { ValidationDomainError } from "../errors/domain-error";

export type BomItemType = "FIXED_MATERIAL" | "VARIABLE_MATERIAL";
export type MaterialGroup = "LEATHER" | "HARDWARE" | "ADHESIVE" | "THREAD" | "OTHER";

interface BaseBomItemProps {
  itemType: BomItemType;
}

export interface FixedMaterialItemProps extends BaseBomItemProps {
  itemType: "FIXED_MATERIAL";
  materialId: number;
  qtyPerUnit: number;
}

export interface VariableMaterialItemProps extends BaseBomItemProps {
  itemType: "VARIABLE_MATERIAL";
  materialGroup: MaterialGroup;
  plannedQtyPerUnit: number;
  unit: string;
}

export type TechnicalSpecItemProps = FixedMaterialItemProps | VariableMaterialItemProps;

export class TechnicalSpecItem {
  constructor(private readonly props: TechnicalSpecItemProps) {
    if (this.props.itemType === "FIXED_MATERIAL") {
      if (this.props.qtyPerUnit <= 0) throw new ValidationDomainError("qtyPerUnit must be greater than zero");
    } else {
      if (this.props.plannedQtyPerUnit <= 0) throw new ValidationDomainError("plannedQtyPerUnit must be greater than zero");
      if (!this.props.unit.trim()) throw new ValidationDomainError("Variable material unit is required");
    }
  }

  get itemType(): BomItemType {
    return this.props.itemType;
  }

  get materialId(): number | undefined {
    return this.props.itemType === "FIXED_MATERIAL" ? this.props.materialId : undefined;
  }

  get materialGroup(): MaterialGroup | undefined {
    return this.props.itemType === "VARIABLE_MATERIAL" ? this.props.materialGroup : undefined;
  }

  calculateFixedConsumption(productionQuantity: number): number {
    if (this.props.itemType !== "FIXED_MATERIAL") return 0;
    return this.props.qtyPerUnit * productionQuantity;
  }
}
