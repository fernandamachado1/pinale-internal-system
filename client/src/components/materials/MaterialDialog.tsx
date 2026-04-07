import { useEffect, useState } from "react";
import type { InsertMaterial, Material } from "@shared/schema";
import { useCreateManyMaterials, useUpdateMaterial } from "@/hooks/use-erp";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl } from "@/lib/format";
import { fromPtBrDecimal, toPtBrDecimal } from "@/lib/ptbr-number";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const purchasePrice = item.category === "RAW_MATERIAL" ? (item.pricePerSquareMeter || "0") : item.purchasePrice;
  return {
    name: item.name,
    category: item.category,
    unitOfMeasure: item.unitOfMeasure,
    stockQty: item.stockQty,
    purchasePrice,
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

function ensureDefaultUnit(item: MaterialFormValues): MaterialFormValues {
  if (item.category === "RAW_MATERIAL") {
    return { ...item, unitOfMeasure: "SQUARE_METER" };
  }
  return item;
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
  asPage?: boolean;
  onBack?: () => void;
  hideInitialStockField?: boolean;
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
  asPage = false,
  onBack,
  hideInitialStockField = false,
}: MaterialDialogProps) {
  const createManyMutation = useCreateManyMaterials();
  const updateMutation = useUpdateMaterial();
  const isEditing = Boolean(editMaterial);
  const [items, setItems] = useState<MaterialFormValues[]>([createEmptyMaterialForm()]);

  useEffect(() => {
    if (!open) return;
    if (editMaterial) {
      setItems([ensureDefaultUnit(fromMaterial(editMaterial))]);
      return;
    }

    const empty = createEmptyMaterialForm();
    if (initialName?.trim()) empty.name = initialName.trim();
    if (hideInitialStockField) empty.stockQty = "0";
    setItems([ensureDefaultUnit(empty)]);
  }, [open, editMaterial, initialName, hideInitialStockField]);

  const updateItem = (index: number, patch: Partial<MaterialFormValues>) => {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => setItems((current) => [...current, createEmptyMaterialForm()]);

  const removeItem = (index: number) => {
    setItems((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  };

  const closeView = () => {
    if (asPage) {
      onBack?.();
      return;
    }
    onOpenChange(false);
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
          onSuccess: closeView,
        },
      );
      return;
    }

    createManyMutation.mutate(
      { items: items.map(toCreatePayload) },
      {
        onSuccess: (created) => {
          onCreated?.(created);
          closeView();
        },
      },
    );
  };

  const resolvedTitle = title ?? (isEditing ? "Editar material" : "Novo material");
  const resolvedDescription = description ?? (isEditing ? "Atualize os dados do material selecionado." : "Cadastre um ou mais materiais no mesmo fluxo.");

  const addMaterialButton = !isEditing && allowMultiple ? (
    <Button type="button" variant="outline" onClick={addItem}>
      Adicionar novo material
    </Button>
  ) : null;

  const actionButtons = (
    <>
      <Button type="button" variant="outline" onClick={closeView}>
        Cancelar
      </Button>
      <Button type="submit" disabled={createManyMutation.isPending || updateMutation.isPending}>
        {isEditing ? "Salvar" : allowMultiple ? "Criar materiais" : "Criar material"}
      </Button>
    </>
  );

  const formClassName = cn("flex flex-col", { "h-full": asPage });
  const scrollContainerClassName = cn("space-y-4", {
    "max-h-[60vh] overflow-auto pr-1": !asPage,
    "flex-1 overflow-y-auto": asPage,
  });

  const formContent = (
    <form onSubmit={handleSubmit} className={formClassName}>
      <div className={scrollContainerClassName}>
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
                <Select
                  value={item.category}
                  onValueChange={(value) =>
                    updateItem(index, {
                      category: value as MaterialCategory,
                      pricePerSquareMeter: value === "RAW_MATERIAL" ? item.pricePerSquareMeter || item.purchasePrice : item.pricePerSquareMeter,
                      unitOfMeasure: value === "RAW_MATERIAL" ? "SQUARE_METER" : item.unitOfMeasure,
                    })
                  }
                >
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
              {!hideInitialStockField ? (
                <div className="space-y-2">
                  <Label>Estoque inicial</Label>
                  <Input
                    inputMode="decimal"
                    value={toPtBrDecimal(item.stockQty)}
                    onChange={(e) => {
                      const decimals = item.unitOfMeasure === "UNIT" ? 0 : 3;
                      updateItem(index, { stockQty: fromPtBrDecimal(e.target.value, decimals) });
                    }}
                    placeholder="0,000"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>Estoque inicial</Label>
                  <p className="text-xs text-muted-foreground">
                    O estoque será registrado automaticamente ao receber a ordem de compra.
                  </p>
                </div>
              )}
              {item.category !== "RAW_MATERIAL" ? (
                <div className="space-y-2">
                  <Label>Valor de compra</Label>
                  <Input
                    inputMode="decimal"
                    value={toPtBrDecimal(item.purchasePrice)}
                    onChange={(e) => updateItem(index, { purchasePrice: fromPtBrDecimal(e.target.value, 2) })}
                    placeholder="0,00"
                    required
                  />
                </div>
              ) : null}
            </div>

            {item.category === "RAW_MATERIAL" ? (
              <div className="space-y-2">
                <Label>Valor por m²</Label>
                <Input
                  inputMode="decimal"
                  value={toPtBrDecimal(item.pricePerSquareMeter)}
                  onChange={(e) => updateItem(index, { pricePerSquareMeter: fromPtBrDecimal(e.target.value, 2) })}
                  placeholder="0,00"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Valor total em estoque: {brl(Number(item.pricePerSquareMeter || "0") * Number(item.stockQty || "0"))}
                </p>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {asPage ? (
        <div className="border-t pt-4">
          {addMaterialButton ? (
            <div className="pb-4">{addMaterialButton}</div>
          ) : null}
          <div className="flex justify-end gap-2">
            {actionButtons}
          </div>
        </div>
      ) : (
        <>
          {addMaterialButton ? (
            <div className="border-t pt-4">{addMaterialButton}</div>
          ) : null}
          <ResponsiveDialogFooter className="justify-end gap-2">
            {actionButtons}
          </ResponsiveDialogFooter>
        </>
      )}
    </form>
  );

  if (asPage) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
        <header className="flex items-start gap-3 border-b pb-3">
          <Button type="button" variant="outline" size="icon" onClick={closeView} aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{resolvedTitle}</h1>
            <p className="text-sm text-muted-foreground">{resolvedDescription}</p>
          </div>
        </header>
        <div className="flex-1 flex flex-col overflow-hidden px-6 py-6">
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{resolvedTitle}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{resolvedDescription}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {formContent}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
