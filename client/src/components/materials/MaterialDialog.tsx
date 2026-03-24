import { useEffect, useState } from "react";
import type { InsertMaterial, Material } from "@shared/schema";
import { useCreateManyMaterials, useUpdateMaterial } from "@/hooks/use-erp";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogFooter, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fromPtBrDecimal, toPtBrDecimal } from "@/lib/ptbr-number";

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
  initialName?: string;
  allowMultiple?: boolean;
}

export function MaterialDialog({
  open,
  onOpenChange,
  editMaterial,
  onCreated,
  title,
  description,
  initialName,
  allowMultiple = true,
}: MaterialDialogProps) {
  const createManyMutation = useCreateManyMaterials();
  const updateMutation = useUpdateMaterial();
  const isEditing = Boolean(editMaterial);
  const [items, setItems] = useState<MaterialFormValues[]>([createEmptyMaterialForm()]);

  useEffect(() => {
    if (!open) return;
    if (editMaterial) {
      setItems([fromMaterial(editMaterial)]);
      return;
    }

    const empty = createEmptyMaterialForm();
    if (initialName?.trim()) empty.name = initialName.trim();
    setItems([empty]);
  }, [open, editMaterial, initialName]);

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
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title ?? (isEditing ? "Editar material" : "Novo material")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {description ?? (isEditing ? "Atualize os dados do material selecionado." : "Cadastre um ou mais materiais no mesmo fluxo.")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-h-[60vh] space-y-4 overflow-auto pr-1">
            {items.map((item, index) => (
              <div key={index} className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Material {index + 1}</h3>
                  {!isEditing && allowMultiple ? (
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
                    <Input
                      inputMode="decimal"
                      value={toPtBrDecimal(item.stockQty)}
                      onChange={(e) => updateItem(index, { stockQty: fromPtBrDecimal(e.target.value) })}
                      placeholder="0,000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor de compra</Label>
                    <Input
                      inputMode="decimal"
                      value={toPtBrDecimal(item.purchasePrice)}
                      onChange={(e) => updateItem(index, { purchasePrice: fromPtBrDecimal(e.target.value) })}
                      placeholder="0,00"
                      required
                    />
                  </div>
                </div>

                {item.category === "RAW_MATERIAL" ? (
                  <div className="space-y-2">
                    <Label>Valor por m²</Label>
                    <Input
                      inputMode="decimal"
                      value={toPtBrDecimal(item.pricePerSquareMeter)}
                      onChange={(e) => updateItem(index, { pricePerSquareMeter: fromPtBrDecimal(e.target.value) })}
                      placeholder="0,00"
                      required
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <ResponsiveDialogFooter className="justify-between sm:justify-between">
            <div>
              {!isEditing && allowMultiple ? (
                <Button type="button" variant="outline" onClick={addItem}>
                  Adicionar novo material
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={createManyMutation.isPending || updateMutation.isPending}>
                {isEditing ? "Salvar" : allowMultiple ? "Criar materiais" : "Criar material"}
              </Button>
            </div>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
