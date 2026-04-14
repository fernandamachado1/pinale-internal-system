import { api, buildUrl } from "@shared/routes";
import type { DashboardReport } from "@shared/routes";
import type {
  AdjustProducedStockInput,
  CatalogProduct,
  CreateManyMaterialsInput,
  ConcludeProductionOrderInput,
  InsertMaterial,
  MoveProductionOrderInput,
  InsertProductionOrder,
  InsertSale,
  Material,
  MovementWithDetails,
  ProductWithBom,
  ProducedProductStockSummary,
  ProducedProductStockWithProduct,
  ProductionOrderWithProduct,
  PurchaseOrderWithItems,
  CreatePurchaseOrderInput,
  RegisterInitialProducedStockInput,
  UpdatePurchaseOrderInput,
  ReceivePurchaseOrderInput,
  SaleListItem,
} from "@shared/schema";
import type { IErpGateway } from "@/application/contracts/erp-gateway";
import { AppError } from "@/lib/app-error";
import { apiFetch } from "@/lib/api-fetch";

async function parseJsonResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string; code?: string; field?: string } | null;
    throw new AppError(payload?.message || fallbackMessage, payload?.code, payload?.field);
  }
  return (await res.json()) as T;
}

async function throwIfNotOk(res: Response, fallbackMessage: string): Promise<void> {
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string; code?: string; field?: string } | null;
    throw new AppError(payload?.message || fallbackMessage, payload?.code, payload?.field);
  }
}

export class HttpErpGateway implements IErpGateway {
  async getMaterials(): Promise<Material[]> {
    const res = await apiFetch(api.materials.list.path);
    return parseJsonResponse<Material[]>(res, "Falha ao carregar materiais");
  }

  async createMaterial(data: InsertMaterial): Promise<Material> {
    const res = await apiFetch(api.materials.create.path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<Material>(res, "Falha ao criar material");
  }

  async createManyMaterials(data: CreateManyMaterialsInput): Promise<Material[]> {
    const res = await apiFetch(api.materials.createMany.path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<Material[]>(res, "Falha ao criar materiais");
  }

  async updateMaterial(id: number, data: Partial<InsertMaterial>): Promise<Material> {
    const res = await apiFetch(buildUrl(api.materials.update.path, { id }), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<Material>(res, "Falha ao atualizar material");
  }

  async deleteMaterial(id: number): Promise<void> {
    const res = await apiFetch(buildUrl(api.materials.delete.path, { id }), { method: "DELETE" });
    await throwIfNotOk(res, "Falha ao excluir material");
  }

  async getProducedProductStocks(): Promise<ProducedProductStockWithProduct[]> {
    const res = await apiFetch(api.producedProductStocks.list.path);
    return parseJsonResponse<ProducedProductStockWithProduct[]>(res, "Falha ao carregar estoque produzido");
  }

  async getProducedProductStockSummary(): Promise<ProducedProductStockSummary[]> {
    const res = await apiFetch(api.producedProductStocks.summary.path);
    return parseJsonResponse<ProducedProductStockSummary[]>(res, "Falha ao carregar resumo de estoque produzido");
  }

  async registerInitialProducedStock(data: RegisterInitialProducedStockInput): Promise<ProducedProductStockWithProduct> {
    const res = await apiFetch(api.producedProductStocks.registerInitial.path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<ProducedProductStockWithProduct>(res, "Falha ao registrar entrada inicial");
  }

  async adjustProducedStock(data: AdjustProducedStockInput): Promise<ProducedProductStockWithProduct> {
    const res = await apiFetch(api.producedProductStocks.adjust.path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<ProducedProductStockWithProduct>(res, "Falha ao ajustar estoque");
  }

  async getProducts(): Promise<ProductWithBom[]> {
    const res = await apiFetch(api.products.list.path);
    return parseJsonResponse<ProductWithBom[]>(res, "Falha ao carregar produtos");
  }

  async getCatalogProducts(input: { q?: string; page: number; pageSize: number }): Promise<{ items: CatalogProduct[]; total: number }> {
    const params = new URLSearchParams();
    params.set("page", String(input.page));
    params.set("pageSize", String(input.pageSize));
    if (input.q?.trim()) params.set("q", input.q.trim());
    const res = await apiFetch(`${api.products.catalog.path}?${params.toString()}`);
    return parseJsonResponse<{ items: CatalogProduct[]; total: number }>(res, "Falha ao carregar catálogo");
  }

  async createProduct(data: unknown): Promise<ProductWithBom> {
    const res = await apiFetch(api.products.create.path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<ProductWithBom>(res, "Falha ao criar produto");
  }

  async updateProduct(id: number, data: unknown): Promise<ProductWithBom> {
    const res = await apiFetch(buildUrl(api.products.update.path, { id }), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<ProductWithBom>(res, "Falha ao atualizar produto");
  }

  async deleteProduct(id: number): Promise<void> {
    const res = await apiFetch(buildUrl(api.products.delete.path, { id }), { method: "DELETE" });
    await throwIfNotOk(res, "Falha ao excluir produto");
  }

  async getProductionOrders(): Promise<ProductionOrderWithProduct[]> {
    const res = await apiFetch(api.productionOrders.list.path);
    return parseJsonResponse<ProductionOrderWithProduct[]>(res, "Falha ao carregar ordens de produção");
  }

  async createProductionOrder(data: InsertProductionOrder): Promise<ProductionOrderWithProduct> {
    const res = await apiFetch(api.productionOrders.create.path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<ProductionOrderWithProduct>(res, "Falha ao criar ordem de produção");
  }

  async moveProductionOrder(id: number, data: MoveProductionOrderInput): Promise<ProductionOrderWithProduct> {
    const res = await apiFetch(buildUrl(api.productionOrders.move.path, { id }), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<ProductionOrderWithProduct>(res, "Falha ao mover ordem de produção");
  }

  async concludeProductionOrder(id: number, data: ConcludeProductionOrderInput): Promise<ProductionOrderWithProduct> {
    const res = await apiFetch(buildUrl(api.productionOrders.conclude.path, { id }), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<ProductionOrderWithProduct>(res, "Falha ao concluir ordem de produção");
  }

  async getSales(): Promise<SaleListItem[]> {
    const res = await apiFetch(api.sales.list.path);
    return parseJsonResponse<SaleListItem[]>(res, "Falha ao carregar vendas");
  }

  async createSale(data: InsertSale): Promise<{ sale: unknown; items: unknown[] }> {
    const res = await apiFetch(api.sales.create.path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<{ sale: unknown; items: unknown[] }>(res, "Falha ao criar venda");
  }

  async deleteSale(id: number): Promise<void> {
    const res = await apiFetch(buildUrl(api.sales.delete.path, { id }), { method: "DELETE" });
    await throwIfNotOk(res, "Falha ao excluir venda");
  }

  async getInventoryMovements(): Promise<MovementWithDetails[]> {
    const res = await apiFetch(api.inventory.movements.path);
    return parseJsonResponse<MovementWithDetails[]>(res, "Falha ao carregar movimentações de estoque");
  }

  async getPurchaseOrders(): Promise<PurchaseOrderWithItems[]> {
    const res = await apiFetch(api.purchaseOrders.list.path);
    return parseJsonResponse<PurchaseOrderWithItems[]>(res, "Falha ao carregar ordens de compra");
  }

  async createPurchaseOrder(data: CreatePurchaseOrderInput): Promise<PurchaseOrderWithItems> {
    const res = await apiFetch(api.purchaseOrders.create.path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<PurchaseOrderWithItems>(res, "Falha ao criar ordem de compra");
  }

  async updatePurchaseOrder(id: number, data: UpdatePurchaseOrderInput): Promise<PurchaseOrderWithItems> {
    const res = await apiFetch(buildUrl(api.purchaseOrders.update.path, { id }), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<PurchaseOrderWithItems>(res, "Falha ao atualizar ordem de compra");
  }

  async receivePurchaseOrder(id: number, data: ReceivePurchaseOrderInput): Promise<PurchaseOrderWithItems> {
    const res = await apiFetch(buildUrl(api.purchaseOrders.receive.path, { id }), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<PurchaseOrderWithItems>(res, "Falha ao receber ordem de compra");
  }

  async cancelPurchaseOrder(id: number): Promise<void> {
    const res = await apiFetch(buildUrl(api.purchaseOrders.cancel.path, { id }), { method: "DELETE" });
    await throwIfNotOk(res, "Falha ao cancelar ordem de compra");
  }

  async getDashboardReport(from?: Date, to?: Date): Promise<DashboardReport> {
    const params = new URLSearchParams();
    if (from) params.set("from", from.toISOString());
    if (to) params.set("to", to.toISOString());
    const url = `${api.reports.dashboard.path}?${params.toString()}`;
    const res = await apiFetch(url);
    return parseJsonResponse<DashboardReport>(res, "Falha ao carregar relatório do painel");
  }
}
