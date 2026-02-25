import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { useCreateProduct, useDeleteProduct, useMaterials, useProducts, useUpdateProduct } from "@/hooks/use-erp";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus } from "lucide-react";

type BomFormItem =
  | { itemType: "FIXED_MATERIAL"; materialId: string; qtyPerUnit: string }
  | { itemType: "VARIABLE_MATERIAL"; materialGroup: "LEATHER" | "HARDWARE" | "ADHESIVE" | "THREAD" | "OTHER"; plannedQtyPerUnit: string; unit: string };

const groupLabels: Record<"LEATHER" | "HARDWARE" | "ADHESIVE" | "THREAD" | "OTHER", string> = {
  LEATHER: "Couro",
  HARDWARE: "Ferragens",
  ADHESIVE: "Adesivos",
  THREAD: "Linha",
  OTHER: "Outros",
};

export default function Products() {
  const { data: products } = useProducts();
  const { data: materials } = useMaterials();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [bomItems, setBomItems] = useState<BomFormItem[]>([]);

  const filteredProducts = useMemo(
    () => products?.filter((product) => product.name.toLowerCase().includes(searchTerm.toLowerCase())) ?? [],
    [products, searchTerm],
  );

  const activeMaterials = useMemo(() => materials?.filter((material) => material.isActive === 1) ?? [], [materials]);

  const addFixedItem = () => setBomItems((prev) => [...prev, { itemType: "FIXED_MATERIAL", materialId: "", qtyPerUnit: "1" }]);
  const addVariableItem = () =>
    setBomItems((prev) => [...prev, { itemType: "VARIABLE_MATERIAL", materialGroup: "LEATHER", plannedQtyPerUnit: "1", unit: "M2" }]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const payload = {
      product: { name, price, isActive: 1 },
      bomItems: bomItems.map((item) => {
        if (item.itemType === "FIXED_MATERIAL") {
          return {
            itemType: "FIXED_MATERIAL" as const,
            materialId: Number(item.materialId),
            qtyPerUnit: item.qtyPerUnit,
          };
        }

        return {
          itemType: "VARIABLE_MATERIAL" as const,
          materialGroup: item.materialGroup,
          plannedQtyPerUnit: item.plannedQtyPerUnit,
          unit: item.unit,
        };
      }),
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        setIsOpen(false);
        setName("");
        setPrice("");
        setBomItems([]);
      },
    });
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Package className="w-8 h-8 text-primary" /> Produtos
        </h1>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Produto</DialogTitle>
              <DialogDescription>Defina o produto e sua ficha técnica.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Preço</Label>
                  <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ficha técnica</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={addFixedItem}>Adicionar material fixo</Button>
                  <Button type="button" variant="outline" size="sm" onClick={addVariableItem}>Adicionar consumo variável</Button>
                </div>
              </div>

              <div className="space-y-3 max-h-72 overflow-auto">
                {bomItems.map((item, index) => (
                  <div key={index} className="border rounded p-3 space-y-2">
                    <div className="font-semibold text-sm">{item.itemType === "FIXED_MATERIAL" ? "Material fixo" : "Consumo variável"}</div>
                    {item.itemType === "FIXED_MATERIAL" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <Select
                          value={item.materialId}
                          onValueChange={(value) =>
                            setBomItems((prev) => prev.map((entry, idx) => (idx === index && entry.itemType === "FIXED_MATERIAL" ? { ...entry, materialId: value } : entry)))
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Selecione o material" /></SelectTrigger>
                          <SelectContent>
                            {activeMaterials.map((material) => (
                            <SelectItem key={material.id} value={String(material.id)}>{material.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.001"
                          value={item.qtyPerUnit}
                          onChange={(e) =>
                            setBomItems((prev) => prev.map((entry, idx) => (idx === index && entry.itemType === "FIXED_MATERIAL" ? { ...entry, qtyPerUnit: e.target.value } : entry)))
                          }
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <Select
                          value={item.materialGroup}
                          onValueChange={(value: "LEATHER" | "HARDWARE" | "ADHESIVE" | "THREAD" | "OTHER") =>
                            setBomItems((prev) =>
                              prev.map((entry, idx) => (idx === index && entry.itemType === "VARIABLE_MATERIAL" ? { ...entry, materialGroup: value } : entry)),
                            )
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(["LEATHER", "HARDWARE", "ADHESIVE", "THREAD", "OTHER"] as const).map((group) => (
                              <SelectItem key={group} value={group}>{groupLabels[group]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.001"
                          value={item.plannedQtyPerUnit}
                          onChange={(e) =>
                            setBomItems((prev) =>
                              prev.map((entry, idx) =>
                                idx === index && entry.itemType === "VARIABLE_MATERIAL" ? { ...entry, plannedQtyPerUnit: e.target.value } : entry,
                              ),
                            )
                          }
                        />
                        <Input
                          value={item.unit}
                          onChange={(e) =>
                            setBomItems((prev) =>
                              prev.map((entry, idx) => (idx === index && entry.itemType === "VARIABLE_MATERIAL" ? { ...entry, unit: e.target.value } : entry)),
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4">
        <Input placeholder="Buscar produto" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Preço</TableHead>
            <TableHead>Estoque</TableHead>
            <TableHead>Ficha técnica</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProducts.map((item) => (
            <TableRow key={item.id}>
              <TableCell>#{item.id}</TableCell>
              <TableCell>{item.name}</TableCell>
              <TableCell>R$ {Number(item.price).toFixed(2)}</TableCell>
              <TableCell>{item.stockQty}</TableCell>
              <TableCell>
                <div className="text-sm text-muted-foreground">
                  {item.bomItems.length === 0
                    ? "Sem itens"
                    : `${item.bomItems.filter((entry) => entry.itemType === "FIXED_MATERIAL").length} fixo(s), ${item.bomItems.filter((entry) => entry.itemType === "VARIABLE_MATERIAL").length} variável(is)`}
                </div>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updateMutation.isPending}
                  onClick={() => {
                    const nextName = window.prompt("Nome", item.name);
                    if (!nextName) return;
                    updateMutation.mutate({ id: item.id, data: { product: { name: nextName } } });
                  }}
                >
                  Editar
                </Button>
                <Button size="sm" variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(item.id)}>
                  Inativar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Layout>
  );
}
