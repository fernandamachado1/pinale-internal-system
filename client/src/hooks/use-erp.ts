import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type {
  ConcludeProductionOrderInput,
  InsertMaterial,
  InsertProductionOrder,
  InsertSale,
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { HttpErpGateway } from "@/infra/repositories/http-erp-gateway";
import {
  ConcludeProductionOrderUseCase,
  CreateMaterialUseCase,
  CreateProductUseCase,
  CreateProductionOrderUseCase,
  CreateSaleUseCase,
  DeleteMaterialUseCase,
  DeleteProductUseCase,
  GetInventoryMovementsUseCase,
  GetMaterialsUseCase,
  GetProductionOrdersUseCase,
  GetProductsUseCase,
  GetSalesUseCase,
  UpdateMaterialUseCase,
  UpdateProductUseCase,
} from "@/application/use-cases/erp-use-cases";

const gateway = new HttpErpGateway();

const getMaterialsUseCase = new GetMaterialsUseCase(gateway);
const createMaterialUseCase = new CreateMaterialUseCase(gateway);
const updateMaterialUseCase = new UpdateMaterialUseCase(gateway);
const deleteMaterialUseCase = new DeleteMaterialUseCase(gateway);

const getProductsUseCase = new GetProductsUseCase(gateway);
const createProductUseCase = new CreateProductUseCase(gateway);
const updateProductUseCase = new UpdateProductUseCase(gateway);
const deleteProductUseCase = new DeleteProductUseCase(gateway);

const getProductionOrdersUseCase = new GetProductionOrdersUseCase(gateway);
const createProductionOrderUseCase = new CreateProductionOrderUseCase(gateway);
const concludeProductionOrderUseCase = new ConcludeProductionOrderUseCase(gateway);

const getSalesUseCase = new GetSalesUseCase(gateway);
const createSaleUseCase = new CreateSaleUseCase(gateway);

const getInventoryMovementsUseCase = new GetInventoryMovementsUseCase(gateway);

function useCrudToast() {
  const { toast } = useToast();
  const success = (description: string) => toast({ title: "Sucesso", description });
  const error = (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" });
  return { success, error };
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

export function useDeleteMaterial() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (id: number) => deleteMaterialUseCase.execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.materials.list.path] });
      message.success("Material inativado com sucesso.");
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

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (data: unknown) => createProductUseCase.execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
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
      message.success("Produto inativado com sucesso.");
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
      message.success("Ordem de produção criada com sucesso.");
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
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.inventory.movements.path] });
      message.success("Ordem de produção concluída com sucesso.");
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

export function useCreateSale() {
  const queryClient = useQueryClient();
  const message = useCrudToast();

  return useMutation({
    mutationFn: (data: InsertSale) => createSaleUseCase.execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sales.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.inventory.movements.path] });
      message.success("Venda registrada com sucesso.");
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
