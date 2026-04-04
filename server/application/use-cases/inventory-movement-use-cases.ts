import type { MovementWithDetails } from "@shared/schema.ts";
import type { IErpRepository } from "../contracts/erp-repository.ts";

export class ListInventoryMovementsUseCase {
  constructor(private readonly repository: IErpRepository) {}

  execute(): Promise<MovementWithDetails[]> {
    return this.repository.getInventoryMovements();
  }
}
