import type { Request, Response } from "express";
import { api } from "@shared/routes";
import { CreateSaleUseCase } from "../application/use-cases/create-sale-use-case";
import { GetSaleUseCase, ListSalesUseCase } from "../application/use-cases/sale-use-cases";
import type { ISalesRepository } from "../application/contracts/sales-repository";

export class SalesController {
  private readonly listSalesUseCase: ListSalesUseCase;
  private readonly getSaleUseCase: GetSaleUseCase;
  private readonly createSaleUseCase: CreateSaleUseCase;

  constructor(repository: ISalesRepository) {
    this.listSalesUseCase = new ListSalesUseCase(repository);
    this.getSaleUseCase = new GetSaleUseCase(repository);
    this.createSaleUseCase = new CreateSaleUseCase(repository);
  }

  async listSales(_req: Request, res: Response): Promise<void> {
    res.json(await this.listSalesUseCase.execute());
  }

  async getSale(req: Request, res: Response): Promise<void> {
    res.json(await this.getSaleUseCase.execute(Number(req.params.id)));
  }

  async createSale(req: Request, res: Response): Promise<void> {
    const input = api.sales.create.input.parse(req.body);
    const result = await this.createSaleUseCase.execute(input);
    res.status(201).json(await this.getSaleUseCase.execute(result.saleId));
  }
}
