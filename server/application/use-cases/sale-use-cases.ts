import type { SaleListItem } from "@shared/schema";
import type { IErpRepository } from "../contracts/erp-repository";
import { NotFoundDomainError } from "../../domain/errors/domain-error";

export class ListSalesUseCase {
  constructor(private readonly repository: IErpRepository) {}

  execute(): Promise<SaleListItem[]> {
    return this.repository.getSales();
  }
}

export class GetSaleUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number): Promise<{
    sale: import("@shared/schema").Sale;
    items: Array<import("@shared/schema").SaleItem & { product: import("@shared/schema").Product }>;
  }> {
    const sale = await this.repository.getSaleWithItems(id);
    if (!sale) throw new NotFoundDomainError("Sale not found");
    return sale;
  }
}
