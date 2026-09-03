import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type {
  CreateManyMaterialsInput,
  ConcludeProductionOrderInput,
  CreatePurchaseOrderInput,
  InsertMaterial,
  InsertProductionOrder,
  ReorderPurchaseOrdersInput,
  ReceivePurchaseOrderInput,
  InsertSale,
  ProductionOrderWithProduct,
  PurchaseOrderWithItems,
  UpdateProductionOrderFinancialsInput,
  UpdatePurchaseOrderInput,
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { HttpErpGateway } from "@/infra/repositories/http-erp-gateway";
import { isAppError } from "@/lib/app-error";
import {
  AdjustProducedStockUseCase,
  ConcludeProductionOrderUseCase,
  CreateMaterialUseCase,
  CreateManyMaterialsUseCase,
  CreateProductUseCase,
  MoveProductionOrderUseCase,
  CreateProductionOrderUseCase,
  DeliverProductionOrderUseCase,
  DeleteProductionOrderUseCase,
  CreateSaleUseCase,
  DeleteSaleUseCase,
  DeleteMaterialUseCase,
  DeleteProductUseCase,
  DeletePurchaseOrderUseCase,
  GetDashboardReportUseCase,
  GetInventoryMovementsUseCase,
  GetMaterialsUseCase,
  GetPurchaseOrdersUseCase,
  ReorderPurchaseOrdersUseCase,
  GetProductionOrdersUseCase,
  GetCatalogProductsUseCase,
  GetProducedProductStockSummaryUseCase,
  GetProducedProductStocksUseCase,
  GetProductsUseCase,
  GetSalesUseCase,
  GetSaleUseCase,
  RegisterInitialProducedStockUseCase,
  CancelPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  ReceivePurchaseOrderUseCase,
  UpdatePurchaseOrderUseCase,
  UpdateMaterialUseCase,
  UpdateProductUseCase,
  UpdateProductionOrderUseCase,
  UpdateProductionOrderFinancialsUseCase,
  UpdateSaleUseCase,
} from "@/application/use-cases/erp-use-cases";

const gateway = new HttpErpGateway();

const getMaterialsUseCase = new GetMaterialsUseCase(gateway);
const createMaterialUseCase = new CreateMaterialUseCase(gateway);
const createManyMaterialsUseCase = new CreateManyMaterialsUseCase(gateway);
const updateMaterialUseCase = new UpdateMaterialUseCase(gateway);
const deleteMaterialUseCase = new DeleteMaterialUseCase(gateway);

const getProductsUseCase = new GetProductsUseCase(gateway);
const getCatalogProductsUseCase = new GetCatalogProductsUseCase(gateway);
const getProducedProductStocksUseCase = new GetProducedProductStocksUseCase(gateway);
const getProducedProductStockSummaryUseCase = new GetProducedProductStockSummaryUseCase(gateway);
const registerInitialProducedStockUseCase = new RegisterInitialProducedStockUseCase(gateway);
const adjustProducedStockUseCase = new AdjustProducedStockUseCase(gateway);
const createProductUseCase = new CreateProductUseCase(gateway);
const updateProductUseCase = new UpdateProductUseCase(gateway);
const deleteProductUseCase = new DeleteProductUseCase(gateway);

const getProductionOrdersUseCase = new GetProductionOrdersUseCase(gateway);
const updateProductionOrderUseCase = new UpdateProductionOrderUseCase(gateway);
const createProductionOrderUseCase = new CreateProductionOrderUseCase(gateway);
const moveProductionOrderUseCase = new MoveProductionOrderUseCase(gateway);
const updateProductionOrderFinancialsUseCase = new UpdateProductionOrderFinancialsUseCase(gateway);
const concludeProductionOrderUseCase = new ConcludeProductionOrderUseCase(gateway);
const deliverProductionOrderUseCase = new DeliverProductionOrderUseCase(gateway);
const deleteProductionOrderUseCase = new DeleteProductionOrderUseCase(gateway);

const getSalesUseCase = new GetSalesUseCase(gateway);
const getSaleUseCase = new GetSaleUseCase(gateway);
const createSaleUseCase = new CreateSaleUseCase(gateway);
const deleteSaleUseCase = new DeleteSaleUseCase(gateway);
const updateSaleUseCase = new UpdateSaleUseCase(gateway);

const getInventoryMovementsUseCase = new GetInventoryMovementsUseCase(gateway);
const getDashboardReportUseCase = new GetDashboardReportUseCase(gateway);

const getPurchaseOrdersUseCase = new GetPurchaseOrdersUseCase(gateway);
const reorderPurchaseOrdersUseCase = new ReorderPurchaseOrdersUseCase(gateway);
const createPurchaseOrderUseCase = new CreatePurchaseOrderUseCase(gateway);
const updatePurchaseOrderUseCase = new UpdatePurchaseOrderUseCase(gateway);
const receivePurchaseOrderUseCase = new ReceivePurchaseOrderUseCase(gateway);
const cancelPurchaseOrderUseCase = new CancelPurchaseOrderUseCase(gateway);
const deletePurchaseOrderUseCase = new DeletePurchaseOrderUseCase(gateway);

function useCrudToast() {
  const { toast } = useToast();
  const success = (description: string) => toast({ title: "Sucesso", description });
  const error = (err: Error) => {
    if (isAppError(err) && err.code) {
      const messageByCode: Record<string, string> = {
        NOT_FOUND: "Registro não encontrado.",
        CONFLICT: "Já existe um registro com esses dados.",
        VALIDATION_ERROR: "Dados inválidos. Verifique os campos e tente novamente.",
        INVALID_OPERATION: err.message || "Operação não permitida para este item.",
        BAD_REQUEST: "Requisição inválida. Verifique os dados e tente novamente.",
      };

      const description = messageByCode[err.code] ?? "Não foi possível concluir a operação.";
      toast({
        title: "Erro",
        description: err.field ? `${description} Campo: ${err.field}.` : description,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Erro", description: err.message, variant: "destructive" });
  };
  return { success, error };
}

function updatePurchaseOrderListCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (current: PurchaseOrderWithItems[] | undefined, includeArchived: boolean) => PurchaseOrderWithItems[] | undefined,
) {
  const cachedLists = queryClient.getQueriesData<PurchaseOrderWithItems[]>({ queryKey: [api.purchaseOrders.list.path] });
  for (const [queryKey, current] of cachedLists) {
    const includeArchived = queryKey[1] === "archived";
    const next = updater(current, includeArchived);
    queryClient.setQueryData(queryKey, next);
  }
}

function reorderByIds(orders: PurchaseOrderWithItems[], orderedIds: number[]) {
  const orderRank = new Map(orderedIds.map((id, index) => [id, index]));
  return [...orders].sort((left, right) => {
    const leftRank = orderRank.get(left.id);
    const rightRank = orderRank.get(right.id);
    if (leftRank !== undefined && rightRank !== undefined && leftRank !== rightRank) return leftRank - rightRank;
    if (leftRank !== undefined) return -1;
    if (rightRank !== undefined) return 1;
    return 0;
  });
}

function mergePurchaseOrderIntoList(
  current: PurchaseOrderWithItems[] | undefined,
  updatedOrder: PurchaseOrderWithItems,
  includeArchived: boolean,
) {
  if (!current) return current;
  const exists = current.some((order) => order.id === updatedOrder.id);
  if (!includeArchived && updatedOrder.isActive !== 1) {
    return current.filter((order) => order.id !== updatedOrder.id);
  }

  if (!exists) {
    if (includeArchived || updatedOrder.isActive === 1) return [updatedOrder, ...current];
    return current;
  }

  return current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order));
}

export function useMaterials() {
  return useQuery({
    queryKey: [api.materials.list.path],
    queryFn: () => getMaterialsUseCase.execute(),
  });
}

export function useCreateMaterial() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (data: InsertMaterial) => createMaterialUseCase.execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.materials.list.path] });
      message.success("Material criado com sucesso.");
    },
    onError: message.error,
  });
}

export function useUpdateMaterial() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertMaterial> }) => updateMaterialUseCase.execute(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.materials.list.path] });
      message.success("Material atualizado com sucesso.");
    },
    onError: message.error,
  });
}

export function useCreateManyMaterials() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (data: CreateManyMaterialsInput) => createManyMaterialsUseCase.execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.materials.list.path] });
      message.success("Materiais criados com sucesso.");
    },
    onError: message.error,
  });
}

export function useDeleteMaterial() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (id: number) => deleteMaterialUseCase.execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.materials.list.path] });
      message.success("Material excluído com sucesso.");
    },
    onError: message.error,
  });
}

export function useProducts() {
  return useQuery({
    queryKey: [api.products.list.path],
    queryFn: () => getProductsUseCase.execute(),
  });
}

export function useCatalogProducts(q: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: [api.products.catalog.path, q, page, pageSize],
    placeholderData: (previous) => previous,
    queryFn: () =>
      getCatalogProductsUseCase.execute({
        q: q.trim() || undefined,
        page,
        pageSize,
      }),
  });
}

export function useProducedProductStocks() {
  return useQuery({
    queryKey: [api.producedProductStocks.list.path],
    queryFn: () => getProducedProductStocksUseCase.execute(),
  });
}

export function useProducedProductStockSummary() {
  return useQuery({
    queryKey: [api.producedProductStocks.summary.path],
    queryFn: () => getProducedProductStockSummaryUseCase.execute(),
  });
}

export function useRegisterInitialProducedStock() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (data: { productId: number; qty: number; note?: string | null }) => registerInitialProducedStockUseCase.execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.products.catalog.path] });
      queryClient.invalidateQueries({ queryKey: [api.inventory.movements.path] });
      message.success("Entrada inicial registrada com sucesso.");
    },
    onError: message.error,
  });
}

export function useAdjustProducedStock() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (data: { productId: number; qtyChange: number; note?: string | null }) => adjustProducedStockUseCase.execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.products.catalog.path] });
      queryClient.invalidateQueries({ queryKey: [api.inventory.movements.path] });
      message.success("Ajuste de estoque registrado com sucesso.");
    },
    onError: message.error,
  });
}

export function usePurchaseOrders(options?: { includeArchived?: boolean }) {
  const cacheScope = options?.includeArchived ? "archived" : "active";
  return useQuery({
    queryKey: [api.purchaseOrders.list.path, cacheScope],
    queryFn: () => getPurchaseOrdersUseCase.execute(options),
  });
}

export function useReorderPurchaseOrders() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (data: ReorderPurchaseOrdersInput) => reorderPurchaseOrdersUseCase.execute(data),
    onSuccess: (voidResult, variables) => {
      updatePurchaseOrderListCaches(queryClient, (current) =>
        current ? reorderByIds(current, variables.orderedIds) : current,
      );
    },
    onError: message.error,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (data: CreatePurchaseOrderInput) => createPurchaseOrderUseCase.execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.purchaseOrders.list.path] });
    },
    onError: message.error,
  });
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePurchaseOrderInput }) => updatePurchaseOrderUseCase.execute(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.purchaseOrders.list.path] });
      message.success("Ordem de compra atualizada com sucesso.");
    },
    onError: message.error,
  });
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ReceivePurchaseOrderInput }) => receivePurchaseOrderUseCase.execute(id, data),
    onSuccess: (updatedOrder) => {
      updatePurchaseOrderListCaches(queryClient, (current, includeArchived) =>
        mergePurchaseOrderIntoList(current, updatedOrder, includeArchived),
      );
      queryClient.invalidateQueries({ queryKey: [api.materials.list.path] });
      message.success("Recebimento registrado com sucesso.");
    },
    onError: message.error,
  });
}

export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (id: number) => cancelPurchaseOrderUseCase.execute(id),
    onSuccess: (_voidResult, id) => {
      updatePurchaseOrderListCaches(queryClient, (current, includeArchived) => {
        if (!current) return current;
        if (!includeArchived) return current.filter((order) => order.id !== id);
        return current.map((order) => (order.id === id ? { ...order, isActive: 0, status: "CANCELED" } : order));
      });
      message.success("Ordem de compra cancelada com sucesso.");
    },
    onError: message.error,
  });
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (id: number) => deletePurchaseOrderUseCase.execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.purchaseOrders.list.path] });
      message.success("Ordem de compra excluída com sucesso.");
    },
    onError: message.error,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (data: unknown) => createProductUseCase.execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.products.catalog.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.summary.path] });
      message.success("Produto criado com sucesso.");
    },
    onError: message.error,
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => updateProductUseCase.execute(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.products.catalog.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.summary.path] });
      message.success("Produto atualizado com sucesso.");
    },
    onError: message.error,
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (id: number) => deleteProductUseCase.execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.products.catalog.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.summary.path] });
      message.success("Produto excluído com sucesso.");
    },
    onError: message.error,
  });
}

export function useProductionOrders() {
  return useQuery({
    queryKey: [api.productionOrders.list.path],
    queryFn: () => getProductionOrdersUseCase.execute(),
  });
}

export function useCreateProductionOrder() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (data: InsertProductionOrder) => createProductionOrderUseCase.execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.productionOrders.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.sales.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.inventory.movements.path] });
      queryClient.invalidateQueries({ queryKey: [api.reports.dashboard.path] });
      message.success("Ordem de produção criada com sucesso.");
    },
    onError: message.error,
  });
}

export function useUpdateProductionOrder() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateProductionOrderUseCase.execute>[1] }) =>
      updateProductionOrderUseCase.execute(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.productionOrders.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.sales.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.inventory.movements.path] });
      queryClient.invalidateQueries({ queryKey: [api.reports.dashboard.path] });
      message.success("Ordem de produção atualizada com sucesso.");
    },
    onError: message.error,
  });
}

export function useMoveProductionOrder() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status: "BACKLOG" | "IN_PROGRESS"; orderedIds: number[] } }) => moveProductionOrderUseCase.execute(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.productionOrders.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.materials.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.inventory.movements.path] });
      message.success("Ordem de produção atualizada com sucesso.");
    },
    onError: message.error,
  });
}

export function useUpdateProductionOrderFinancials() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProductionOrderFinancialsInput }) =>
      updateProductionOrderFinancialsUseCase.execute(id, data),
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData([api.productionOrders.list.path], (current: ProductionOrderWithProduct[] | undefined) =>
        current?.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)),
      );
      queryClient.invalidateQueries({ queryKey: [api.productionOrders.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.sales.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.inventory.movements.path] });
      queryClient.invalidateQueries({ queryKey: [api.reports.dashboard.path] });
      message.success("Dados financeiros atualizados com sucesso.");
    },
    onError: message.error,
  });
}

export function useConcludeProductionOrder() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ConcludeProductionOrderInput }) => concludeProductionOrderUseCase.execute(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.productionOrders.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.materials.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.inventory.movements.path] });
      message.success("Ordem de produção concluída com sucesso.");
    },
    onError: message.error,
  });
}

export function useDeliverProductionOrder() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { deliveredAt?: string | null } }) =>
      deliverProductionOrderUseCase.execute(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.productionOrders.list.path] });
      message.success("Entrega registrada com sucesso.");
    },
    onError: message.error,
  });
}

export function useDeleteProductionOrder() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (id: number) => deleteProductionOrderUseCase.execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.productionOrders.list.path] });
      message.success("Ordem de produção excluída com sucesso.");
    },
    onError: message.error,
  });
}

export function useSales() {
  return useQuery({
    queryKey: [api.sales.list.path],
    queryFn: () => getSalesUseCase.execute(),
  });
}

export function useSale(id: number | null) {
  return useQuery({
    queryKey: [api.sales.get.path, id],
    queryFn: () => getSaleUseCase.execute(id as number),
    enabled: Boolean(id),
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (data: InsertSale) => createSaleUseCase.execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sales.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.products.catalog.path] });
      queryClient.invalidateQueries({ queryKey: [api.inventory.movements.path] });
      message.success("Venda registrada com sucesso.");
    },
    onError: message.error,
  });
}

export function useUpdateSale() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: InsertSale }) => updateSaleUseCase.execute(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.sales.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.sales.get.path, variables.id] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.products.catalog.path] });
      queryClient.invalidateQueries({ queryKey: [api.inventory.movements.path] });
      message.success("Venda atualizada com sucesso.");
    },
    onError: message.error,
  });
}

export function useDeleteSale() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (id: number) => deleteSaleUseCase.execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sales.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.producedProductStocks.summary.path] });
      queryClient.invalidateQueries({ queryKey: [api.products.catalog.path] });
      queryClient.invalidateQueries({ queryKey: [api.inventory.movements.path] });
      message.success("Venda excluída com sucesso.");
    },
    onError: message.error,
  });
}

export function useInventoryMovements() {
  return useQuery({
    queryKey: [api.inventory.movements.path],
    queryFn: () => getInventoryMovementsUseCase.execute(),
  });
}

export function useDashboardReport(from?: Date, to?: Date) {
  return useQuery({
    queryKey: [api.reports.dashboard.path, from?.toISOString(), to?.toISOString()],
    queryFn: () => getDashboardReportUseCase.execute(from, to),
  });
}
