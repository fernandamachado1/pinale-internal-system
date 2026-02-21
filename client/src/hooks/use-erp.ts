import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { 
  Material, InsertMaterial, 
  Product, InsertProduct, ProductWithSpecs,
  Production, InsertProduction, ProductionWithProduct,
  Sale, InsertSale, SaleWithProduct,
  InventoryMovement, InsertInventoryMovement, MovementWithDetails
} from "@shared/schema";

// --- Materials Hooks ---

export function useMaterials() {
  return useQuery({
    queryKey: [api.materials.list.path],
    queryFn: async () => {
      const res = await fetch(api.materials.list.path);
      if (!res.ok) throw new Error("Falha ao carregar insumos");
      return await res.json() as Material[];
    },
  });
}

export function useCreateMaterial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertMaterial) => {
      const res = await fetch(api.materials.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao criar insumo");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.materials.list.path] });
      toast({ title: "Sucesso", description: "Insumo criado com sucesso." });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });
}

// --- Products Hooks ---

export function useProducts() {
  return useQuery({
    queryKey: [api.products.list.path],
    queryFn: async () => {
      const res = await fetch(api.products.list.path);
      if (!res.ok) throw new Error("Falha ao carregar produtos");
      return await res.json() as ProductWithSpecs[];
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: any) => {
      // The backend expects { product: InsertProduct, specs: {materialId, quantityRequired}[] }
      const res = await fetch(api.products.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao criar produto");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      toast({ title: "Sucesso", description: "Produto e ficha técnica criados." });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });
}

// --- Production Hooks ---

export function useProductions() {
  return useQuery({
    queryKey: [api.productions.list.path],
    queryFn: async () => {
      const res = await fetch(api.productions.list.path);
      if (!res.ok) throw new Error("Falha ao carregar produções");
      return await res.json() as ProductionWithProduct[];
    },
  });
}

export function useCreateProduction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertProduction) => {
      const res = await fetch(api.productions.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Erro ao registrar produção");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.productions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.materials.list.path] }); // Materials consumed
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });   // Product stock increased
      queryClient.invalidateQueries({ queryKey: [api.inventory.movements.path] }); // Movement logged
      toast({ title: "Sucesso", description: "Produção registrada com sucesso." });
    },
    onError: (error: { message: any; }) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });
}

// --- Sales Hooks ---

export function useSales() {
  return useQuery({
    queryKey: [api.sales.list.path],
    queryFn: async () => {
      const res = await fetch(api.sales.list.path);
      if (!res.ok) throw new Error("Falha ao carregar vendas");
      return await res.json() as SaleWithProduct[];
    },
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertSale) => {
      const res = await fetch(api.sales.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Erro ao registrar venda");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sales.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] }); // Product stock decreased
      queryClient.invalidateQueries({ queryKey: [api.inventory.movements.path] });
      toast({ title: "Sucesso", description: "Venda registrada com sucesso." });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });
}

// --- Inventory Hooks ---

export function useInventoryMovements() {
  return useQuery({
    queryKey: [api.inventory.movements.path],
    queryFn: async () => {
      const res = await fetch(api.inventory.movements.path);
      if (!res.ok) throw new Error("Falha ao carregar movimentações");
      return await res.json() as MovementWithDetails[];
    },
  });
}
