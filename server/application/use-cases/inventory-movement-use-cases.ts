import type { MovementWithDetails } from "@shared/schema";
import type { IErpRepository } from "../contracts/erp-repository";

export class ListInventoryMovementsUseCase {
  constructor(private readonly repository: IErpRepository) {}

  execute(): Promise<MovementWithDetails[]> {
    return this.repository.getInventoryMovements();
  }
}
