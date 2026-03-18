import type { ProducedProductStockWithProduct } from "@shared/schema";
import type { IErpRepository } from "../contracts/erp-repository";

export class ListProducedProductStocksUseCase {
  constructor(private readonly repository: IErpRepository) {}

  execute(): Promise<ProducedProductStockWithProduct[]> {
    return this.repository.getProducedProductStocks();
  }
}
