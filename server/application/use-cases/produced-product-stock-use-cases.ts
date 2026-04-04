import type { ProducedProductStockWithProduct } from "@shared/schema.ts";
import type { IErpRepository } from "../contracts/erp-repository.ts";

export class ListProducedProductStocksUseCase {
  constructor(private readonly repository: IErpRepository) {}

  execute(): Promise<ProducedProductStockWithProduct[]> {
    return this.repository.getProducedProductStocks();
  }
}
