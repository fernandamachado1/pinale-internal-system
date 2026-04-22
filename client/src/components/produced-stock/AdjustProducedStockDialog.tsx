import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdjustProducedStock } from "@/hooks/use-erp";
import { Loader2 } from "lucide-react";

type Direction = "IN" | "OUT";

export type AdjustProducedStockDialogProduct = {
  id: number;
  name: string;
  stockQty?: number | null;
};

export function AdjustProducedStockDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: AdjustProducedStockDialogProduct | null;
}) {
  const adjustMutation = useAdjustProducedStock();
  const product = props.product;

  const currentStockQty = useMemo(() => Number(product?.stockQty ?? 0), [product?.stockQty]);

  const [direction, setDirection] = useState<Direction>("IN");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const isSaving = adjustMutation.isPending;
  const nextStockPreview = useMemo(() => {
    const parsedQty = Number(qty);
    if (!Number.isFinite(parsedQty) || !Number.isInteger(parsedQty) || parsedQty <= 0) return null;
    return direction === "IN" ? currentStockQty + parsedQty : currentStockQty - parsedQty;
  }, [currentStockQty, direction, qty]);

  useEffect(() => {
    if (!props.open) {
      setDirection("IN");
      setQty("1");
      setNote("");
      setFormError(null);
    }
  }, [props.open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!product) return;

    const parsedQty = Number(qty);
    if (!Number.isFinite(parsedQty) || !Number.isInteger(parsedQty) || parsedQty <= 0) {
      setFormError("Informe uma quantidade inteira maior que zero.");
      return;
    }

    if (direction === "OUT" && parsedQty > currentStockQty) {
      setFormError("Saldo insuficiente para realizar a saída.");
      return;
    }

    const qtyChange = direction === "IN" ? parsedQty : -parsedQty;

    await adjustMutation.mutateAsync({
      productId: product.id,
      qtyChange,
      note: note.trim() ? note.trim() : null,
    });
    props.onOpenChange(false);
  }

  return (
    <ResponsiveDialog open={props.open} onOpenChange={props.onOpenChange}>
      <ResponsiveDialogContent className="max-w-lg p-0">
        <ResponsiveDialogHeader>
          <div className="space-y-1">
            <ResponsiveDialogTitle>Ajuste de estoque</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {product ? (
                <span>
                  {product.name} • Saldo atual: <span className="font-medium text-foreground">{currentStockQty}</span>
                  {nextStockPreview !== null ? (
                    <>
                      {" "}
                      • Novo saldo:{" "}
                      <span className={nextStockPreview < 0 ? "font-medium text-destructive" : "font-medium text-foreground"}>{nextStockPreview}</span>
                    </>
                  ) : null}
                </span>
              ) : (
                "Selecione um produto para ajustar o estoque."
              )}
            </ResponsiveDialogDescription>
          </div>
        </ResponsiveDialogHeader>

        <form onSubmit={onSubmit} className="px-4 pb-4 pt-4 md:px-6 md:pb-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={direction} onValueChange={(value) => setDirection(value as Direction)} disabled={!product || isSaving}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">Entrada (+)</SelectItem>
                  <SelectItem value="OUT">Saída (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="1"
                disabled={!product || isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={!product || isSaving} placeholder="Ex.: contagem de inventário / avaria / ajuste manual" />
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>

          <ResponsiveDialogFooter className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!product || isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar ajuste
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

