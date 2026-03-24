import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { PurchaseOrderWithItems, Material } from "@shared/schema";
import { Layout } from "@/components/Layout";
import { useCancelPurchaseOrder, useCreatePurchaseOrder, useMaterials, usePurchaseOrders, useReceivePurchaseOrder, useUpdatePurchaseOrder } from "@/hooks/use-erp";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogFooter, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MaterialDialog } from "@/components/materials/MaterialDialog";
import { MaterialSelectField } from "@/components/materials/MaterialSelectField";
import { ClipboardList, MoreVertical, Plus, Truck, X } from "lucide-react";
import { fromPtBrDecimal, toPtBrDecimal } from "@/lib/ptbr-number";

type PurchaseOrderStatus = PurchaseOrderWithItems["status"];

type PurchaseOrderFormItem = {
  id?: number;
  materialId?: number | null;
  materialName: string;
  qtyOrdered: string;
};

type ReceiveLine = {
  id: number;
  qtyReceiveNow: string;
  materialId?: number | null;
  materialName?: string;
  qtyOrdered?: string;
};

const statusLabels: Record<PurchaseOrderStatus, string> = {
  OPEN: "Aberta",
  PARTIALLY_RECEIVED: "Recebida parcial",
  RECEIVED: "Recebida",
  CANCELED: "Cancelada",
};

function summarizeOrderItems(items: PurchaseOrderWithItems["items"]): { primary: string; secondary?: string } {
  const names = (items ?? []).map((item) => item.materialName).filter(Boolean);
  if (names.length === 0) return { primary: "-" };
  if (names.length === 1) return { primary: names[0] };
  return { primary: names[0], secondary: `+${names.length - 1}` };
}

function formatDate(value: unknown): string {
  if (!value) return "-";
  try {
    return format(new Date(value as any), "dd/MM/yyyy HH:mm");
  } catch {
    return "-";
  }
}

function createEmptyItem(): PurchaseOrderFormItem {
  return { materialId: null, materialName: "", qtyOrdered: "1" };
}

export default function PurchaseOrders() {
  const { data: orders, isLoading, error, refetch } = usePurchaseOrders();
  const { data: materials } = useMaterials();
  const createMutation = useCreatePurchaseOrder();
  const updateMutation = useUpdatePurchaseOrder();
  const receiveMutation = useReceivePurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();

  const activeMaterials = useMemo(() => (materials ?? []).filter((m) => m.isActive === 1), [materials]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderWithItems | null>(null);
  const [formItems, setFormItems] = useState<PurchaseOrderFormItem[]>([createEmptyItem()]);

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrderWithItems | null>(null);
  const [receiveLines, setReceiveLines] = useState<ReceiveLine[]>([]);
  const [confirmReceiveWithoutStockOpen, setConfirmReceiveWithoutStockOpen] = useState(false);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [materialDialogName, setMaterialDialogName] = useState("");
  const [materialDialogTargetItemId, setMaterialDialogTargetItemId] = useState<number | null>(null);

  useEffect(() => {
    if (!dialogOpen) return;
    if (!editingOrder) {
      setFormItems([createEmptyItem()]);
      return;
    }

    setFormItems(
      editingOrder.items.map((item) => ({
        id: item.id,
        materialId: item.materialId ?? null,
        materialName: item.materialName,
        qtyOrdered: String(item.qtyOrdered),
      })),
    );
  }, [dialogOpen, editingOrder]);

  useEffect(() => {
    if (!receiveOpen || !receivingOrder) return;
    setReceiveLines(
      receivingOrder.items.map((item) => ({
        id: item.id,
        qtyReceiveNow: "",
        materialId: item.materialId ?? null,
        materialName: item.materialName,
        qtyOrdered: String(item.qtyOrdered),
      })),
    );
  }, [receiveOpen, receivingOrder]);

  const openCreateDialog = () => {
    setEditingOrder(null);
    setDialogOpen(true);
  };

  const openEditDialog = (order: PurchaseOrderWithItems) => {
    setEditingOrder(order);
    setDialogOpen(true);
  };

  const openReceiveDialog = (order: PurchaseOrderWithItems) => {
    setReceivingOrder(order);
    setReceiveOpen(true);
  };

  const updateFormItem = (index: number, patch: Partial<PurchaseOrderFormItem>) => {
    setFormItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addFormItem = () => setFormItems((current) => [...current, createEmptyItem()]);
  const removeFormItem = (index: number) => {
    setFormItems((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  };

  const submitOrder = (event: React.FormEvent) => {
    event.preventDefault();

    const payloadItems = formItems.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      materialId: item.materialId ?? null,
      materialName: item.materialName,
      qtyOrdered: item.qtyOrdered?.trim() ? item.qtyOrdered : undefined,
    }));

    if (editingOrder) {
      updateMutation.mutate(
        { id: editingOrder.id, data: { items: payloadItems } },
        {
          onSuccess: () => {
            setDialogOpen(false);
            setEditingOrder(null);
          },
        },
      );
      return;
    }

    createMutation.mutate(
      { items: payloadItems.map(({ id: _id, ...rest }) => rest) },
      {
        onSuccess: () => setDialogOpen(false),
      },
    );
  };

  const updateReceiveLine = (itemId: number, patch: Partial<ReceiveLine>) => {
    setReceiveLines((current) => current.map((line) => (line.id === itemId ? { ...line, ...patch } : line)));
  };

  const hasReceiveWithoutStock = useMemo(() => {
    if (!receivingOrder) return false;
    return receiveLines.some((line) => {
      const qty = Number(line.qtyReceiveNow);
      if (!qty || qty <= 0) return false;
      const orderItem = receivingOrder.items.find((i) => i.id === line.id);
      if (!orderItem) return false;
      const effectiveMaterialId = orderItem.materialId ?? line.materialId ?? null;
      return !effectiveMaterialId;
    });
  }, [receiveLines, receivingOrder]);

  const submitReceive = () => {
    if (!receivingOrder) return;

    const linesToSend = receiveLines
      .map((line) => ({
        ...line,
        qtyReceiveNow: line.qtyReceiveNow.trim(),
        materialName: line.materialName?.trim() ? line.materialName.trim() : undefined,
        qtyOrdered: line.qtyOrdered?.trim() ? line.qtyOrdered.trim() : undefined,
      }))
      .filter((line) => Number(line.qtyReceiveNow) > 0);

    if (linesToSend.length === 0) return;

    if (hasReceiveWithoutStock) {
      setConfirmReceiveWithoutStockOpen(true);
      return;
    }

    receiveMutation.mutate(
      { id: receivingOrder.id, data: { items: linesToSend.map((l) => ({ id: l.id, qtyReceiveNow: l.qtyReceiveNow, materialId: l.materialId ?? null, materialName: l.materialName, qtyOrdered: l.qtyOrdered })) } },
      {
        onSuccess: () => {
          setReceiveOpen(false);
          setReceivingOrder(null);
        },
      },
    );
  };

  const confirmReceiveWithoutStock = () => {
    if (!receivingOrder) return;

    const linesToSend = receiveLines
      .map((line) => ({
        ...line,
        qtyReceiveNow: line.qtyReceiveNow.trim(),
        materialName: line.materialName?.trim() ? line.materialName.trim() : undefined,
        qtyOrdered: line.qtyOrdered?.trim() ? line.qtyOrdered.trim() : undefined,
      }))
      .filter((line) => Number(line.qtyReceiveNow) > 0);

    receiveMutation.mutate(
      { id: receivingOrder.id, data: { items: linesToSend.map((l) => ({ id: l.id, qtyReceiveNow: l.qtyReceiveNow, materialId: l.materialId ?? null, materialName: l.materialName, qtyOrdered: l.qtyOrdered })) } },
      {
        onSuccess: () => {
          setConfirmReceiveWithoutStockOpen(false);
          setReceiveOpen(false);
          setReceivingOrder(null);
        },
        onSettled: () => setConfirmReceiveWithoutStockOpen(false),
      },
    );
  };

  const openCreateMaterialForReceiveItem = (item: { id: number; materialName: string }) => {
    setMaterialDialogTargetItemId(item.id);
    setMaterialDialogName(item.materialName);
    setMaterialDialogOpen(true);
  };

  const onMaterialCreated = (created: Material[]) => {
    const first = created[0];
    if (!first || materialDialogTargetItemId === null) return;
    updateReceiveLine(materialDialogTargetItemId, { materialId: first.id, materialName: first.name });
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-primary" />
          Ordens de Compra
        </h1>

        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" /> Nova Ordem
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Não foi possível carregar as ordens de compra</AlertTitle>
          <AlertDescription>
            Verifique se o servidor e o banco estão rodando e tente novamente.
            <div className="mt-3">
              <Button variant="outline" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </div>
      ) : orders?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Criada em</TableHead>
              <TableHead className="hidden md:table-cell">Recebida em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const canEdit = order.status !== "RECEIVED" && order.status !== "CANCELED";
              const canReceive = order.status !== "RECEIVED" && order.status !== "CANCELED";
              const canCancel = order.status !== "RECEIVED" && order.status !== "CANCELED";
              return (
                <TableRow key={order.id}>
                  <TableCell>#{order.id}</TableCell>
                  <TableCell>
                    {(() => {
                      const summary = summarizeOrderItems(order.items);
                      return (
                        <div className="flex items-center gap-2">
                          <span className="max-w-[180px] truncate sm:max-w-[260px] md:max-w-[360px]">
                            {summary.primary}
                          </span>
                          {summary.secondary ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                              {summary.secondary}
                            </span>
                          ) : null}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>{statusLabels[order.status]}</TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(order.createdAt)}</TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(order.receivedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="hidden sm:flex justify-end gap-2">
                      <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => openEditDialog(order)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="outline" disabled={!canReceive} onClick={() => openReceiveDialog(order)}>
                        <Truck className="w-4 h-4 mr-2" /> Receber
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!canCancel || cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(order.id)}
                      >
                        Cancelar
                      </Button>
                    </div>

                    <div className="flex justify-end sm:hidden">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Ações">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled={!canEdit} onSelect={() => openEditDialog(order)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={!canReceive} onSelect={() => openReceiveDialog(order)}>
                            Receber
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={!canCancel || cancelMutation.isPending}
                            onSelect={() => cancelMutation.mutate(order.id)}
                          >
                            Cancelar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Comece criando sua primeira ordem de compra</CardTitle>
            <CardDescription>Crie itens por material ou texto livre e registre recebimentos parciais.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" /> Nova Ordem
            </Button>
          </CardContent>
        </Card>
      )}

      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent className="max-w-3xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{editingOrder ? `Editar OC #${editingOrder.id}` : "Nova Ordem de Compra"}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Adicione itens e quantidades. Selecione um material ou informe o nome livre.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <form onSubmit={submitOrder} className="space-y-4">
            <div className="max-h-[60vh] space-y-4 overflow-auto pr-1">
              {formItems.map((item, index) => (
                <div key={item.id ?? index} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Item {index + 1}</h3>
                    <Button type="button" variant="ghost" size="icon" aria-label="Remover item" onClick={() => removeFormItem(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),180px]">
                    <div className="space-y-2">
                      <Label>Material</Label>
                      <MaterialSelectField
                        materials={activeMaterials}
                        value={{ materialId: item.materialId ?? null, materialName: item.materialName }}
                        onChange={(next) => updateFormItem(index, { materialId: next.materialId, materialName: next.materialName })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Qtd pedida (opcional)</Label>
                      <Input
                        inputMode="decimal"
                        value={toPtBrDecimal(item.qtyOrdered)}
                        onChange={(e) => updateFormItem(index, { qtyOrdered: fromPtBrDecimal(e.target.value) })}
                        placeholder="0,000"
                      />
                    </div>
                  </div>

                  {!item.materialId ? (
                    <p className="text-xs text-muted-foreground">
                      Dica: digite no campo acima e selecione “Usar …” para texto livre.
                    </p>
                  ) : null}
                </div>
              ))}

              <button
                type="button"
                onClick={addFormItem}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="h-4 w-4" />
                Adicionar item
              </button>
            </div>

            <ResponsiveDialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingOrder ? "Salvar" : "Criar"}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <ResponsiveDialogContent className="max-w-3xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{receivingOrder ? `Receber itens da OC #${receivingOrder.id}` : "Receber ordem de compra"}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Informe “Receber agora”. Para itens sem material, você pode vincular/criar um material antes de confirmar.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {receivingOrder ? (
            <div className="max-h-[60vh] space-y-4 overflow-auto pr-1">
              {receivingOrder.items.map((item) => {
                const line = receiveLines.find((l) => l.id === item.id);
                const remaining = Number(item.qtyOrdered) - Number(item.qtyReceived);
                const currentMaterialId = item.materialId ?? line?.materialId ?? null;
                const currentMaterialName = item.materialId ? item.materialName : line?.materialName ?? item.materialName;
                return (
                  <div key={item.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold">{item.materialName}</div>
                        <div className="text-xs text-muted-foreground">
                          Pedido: {item.qtyOrdered} · Já recebido: {item.qtyReceived} · Restante: {remaining.toFixed(3)}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),180px]">
                      <div className="space-y-2">
                        <Label>Material</Label>
                        <MaterialSelectField
                          materials={activeMaterials}
                          value={{ materialId: currentMaterialId, materialName: currentMaterialName }}
                          onChange={(next) => updateReceiveLine(item.id, { materialId: next.materialId, materialName: next.materialName })}
                          placeholder="Buscar ou digitar"
                        />

                        {!currentMaterialId ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openCreateMaterialForReceiveItem({ id: item.id, materialName: currentMaterialName })}
                          >
                            Criar material
                          </Button>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label>Receber agora</Label>
                        <Input
                          inputMode="decimal"
                          value={toPtBrDecimal(line?.qtyReceiveNow ?? "")}
                          onChange={(e) => updateReceiveLine(item.id, { qtyReceiveNow: fromPtBrDecimal(e.target.value) })}
                          placeholder="0,000"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Qtd pedida (opcional)</Label>
                        <Input
                          inputMode="decimal"
                          value={toPtBrDecimal(line?.qtyOrdered ?? String(item.qtyOrdered))}
                          onChange={(e) => updateReceiveLine(item.id, { qtyOrdered: fromPtBrDecimal(e.target.value) })}
                          placeholder="0,000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nome (opcional)</Label>
                        <Input
                          value={line?.materialName ?? item.materialName}
                          onChange={(e) => updateReceiveLine(item.id, { materialName: e.target.value })}
                          disabled={Boolean(currentMaterialId)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => setReceiveOpen(false)}>
              Fechar
            </Button>
            <Button type="button" onClick={submitReceive} disabled={receiveMutation.isPending}>
              Confirmar recebimento
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <AlertDialog open={confirmReceiveWithoutStockOpen} onOpenChange={setConfirmReceiveWithoutStockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Receber sem atualizar estoque?</AlertDialogTitle>
            <AlertDialogDescription>
              Existem itens recebidos que não estão vinculados a nenhum material. Se continuar, o recebimento será registrado, mas o estoque não será atualizado para esses itens.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReceiveWithoutStock}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MaterialDialog
        open={materialDialogOpen}
        onOpenChange={(open) => {
          setMaterialDialogOpen(open);
          if (!open) setMaterialDialogTargetItemId(null);
        }}
        initialName={materialDialogName}
        allowMultiple={false}
        title="Criar material"
        description="Crie o material para vincular ao item recebido. Depois disso, o recebimento pode atualizar o estoque."
        onCreated={onMaterialCreated}
      />
    </Layout>
  );
}
