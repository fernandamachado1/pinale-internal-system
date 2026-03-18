import { useEffect, useState } from "react";
import type { InsertMaterial, Material } from "@shared/schema";
import { useCreateManyMaterials, useUpdateMaterial } from "@/hooks/use-erp";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type MaterialCategory = InsertMaterial["category"];
type UnitOfMeasure = InsertMaterial["unitOfMeasure"];

export type MaterialFormValues = {
  name: string;
  category: MaterialCategory;
  unitOfMeasure: UnitOfMeasure;
  stockQty: string;
  purchasePrice: string;
  pricePerSquareMeter: string;
  isActive: number;
};

const categories: Array<{ value: MaterialCategory; label: string }> = [
  { value: "PACKAGING", label: "Embalagens" },
  { value: "NOTIONS", label: "Aviamentos" },
  { value: "RAW_MATERIAL", label: "Matéria-prima" },
];

const unitOptions: Array<{ value: UnitOfMeasure; label: string }> = [
  { value: "UNIT", label: "Unidade" },
  { value: "SQUARE_METER", label: "Metro quadrado" },
  { value: "METER", label: "Metro" },
];

function createEmptyMaterialForm(): MaterialFormValues {
  return {
    name: "",
    category: "NOTIONS",
    unitOfMeasure: "UNIT",
    stockQty: "0",
    purchasePrice: "0",
    pricePerSquareMeter: "",
    isActive: 1,
  };
}

function toCreatePayload(item: MaterialFormValues): InsertMaterial {
  return {
    name: item.name,
    category: item.category,
    unitOfMeasure: item.unitOfMeasure,
    stockQty: item.stockQty,
    purchasePrice: item.purchasePrice,
    pricePerSquareMeter: item.category === "RAW_MATERIAL" ? item.pricePerSquareMeter : null,
    isActive: item.isActive,
  };
}

function fromMaterial(item: Material): MaterialFormValues {
  return {
    name: item.name,
    category: item.category,
    unitOfMeasure: item.unitOfMeasure,
    stockQty: item.stockQty,
    purchasePrice: item.purchasePrice,
    pricePerSquareMeter: item.pricePerSquareMeter ?? "",
    isActive: item.isActive,
  };
}

interface MaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editMaterial?: Material | null;
  onCreated?: (materials: Material[]) => void;
  title?: string;
  description?: string;
}

export function MaterialDialog({
  open,
  onOpenChange,
  editMaterial,
  onCreated,
  title,
  description,
}: MaterialDialogProps) {
  const createManyMutation = useCreateManyMaterials();
  const updateMutation = useUpdateMaterial();
  const isEditing = Boolean(editMaterial);
  const [items, setItems] = useState<MaterialFormValues[]>([createEmptyMaterialForm()]);

  useEffect(() => {
    if (!open) return;
    setItems(editMaterial ? [fromMaterial(editMaterial)] : [createEmptyMaterialForm()]);
  }, [open, editMaterial]);

  const updateItem = (index: number, patch: Partial<MaterialFormValues>) => {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => setItems((current) => [...current, createEmptyMaterialForm()]);

  const removeItem = (index: number) => {
    setItems((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (editMaterial) {
      updateMutation.mutate(
        {
          id: editMaterial.id,
          data: toCreatePayload(items[0]),
        },
        {
          onSuccess: () => onOpenChange(false),
        },
      );
      return;
    }

    createManyMutation.mutate(
      { items: items.map(toCreatePayload) },
      {
        onSuccess: (created) => {
          onCreated?.(created);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title ?? (isEditing ? "Editar material" : "Novo material")}</DialogTitle>
          <DialogDescription>
            {description ?? (isEditing ? "Atualize os dados do material selecionado." : "Cadastre um ou mais materiais no mesmo fluxo.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-h-[60vh] space-y-4 overflow-auto pr-1">
            {items.map((item, index) => (
              <div key={index} className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Material {index + 1}</h3>
                  {!isEditing ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}>
                      Remover
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={item.name} onChange={(e) => updateItem(index, { name: e.target.value })} required />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={item.category} onValueChange={(value) => updateItem(index, { category: value as MaterialCategory })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.value} value={category.value ?? "NOTIONS"}>{category.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Unidade de medida</Label>
                    <Select value={item.unitOfMeasure} onValueChange={(value) => updateItem(index, { unitOfMeasure: value as UnitOfMeasure })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {unitOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value ?? "UNIT"}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Estoque inicial</Label>
                    <Input type="number" step="0.001" value={item.stockQty} onChange={(e) => updateItem(index, { stockQty: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor de compra</Label>
                    <Input type="number" step="0.01" value={item.purchasePrice} onChange={(e) => updateItem(index, { purchasePrice: e.target.value })} required />
                  </div>
                </div>

                {item.category === "RAW_MATERIAL" ? (
                  <div className="space-y-2">
                    <Label>Valor por m²</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.pricePerSquareMeter}
                      onChange={(e) => updateItem(index, { pricePerSquareMeter: e.target.value })}
                      required
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <DialogFooter className="justify-between sm:justify-between">
            <div>
              {!isEditing ? (
                <Button type="button" variant="outline" onClick={addItem}>
                  Adicionar novo material
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={createManyMutation.isPending || updateMutation.isPending}>
                {isEditing ? "Salvar" : "Criar materiais"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
