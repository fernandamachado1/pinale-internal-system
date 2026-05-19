import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { PurchaseOrderWithItems, Material } from "@shared/schema";
import { nanoid } from "nanoid";
import { Layout } from "@/components/Layout";
import { useCancelPurchaseOrder, useCreatePurchaseOrder, useMaterials, usePurchaseOrders, useReceivePurchaseOrder, useReorderPurchaseOrders, useUpdatePurchaseOrder } from "@/hooks/use-erp";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ClipboardList, GripVertical, Loader2, MoreVertical, Plus, Truck, X } from "lucide-react";
import { fromPtBrDecimal, toPtBrDecimal } from "@/lib/ptbr-number";
import { useToast } from "@/hooks/use-toast";
import { useAuthz } from "@/hooks/use-authz";
import { closestCenter, DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type PurchaseOrderStatus = PurchaseOrderWithItems["status"];

type PurchaseOrderFormItem = {
  clientId: string;
  id?: number;
  materialId?: number | null;
  materialName: string;
  description?: string;
  qtyOrdered: string;
};

type ReceiveLine = {
  id: number;
  qtyReceiveNow?: string;
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

function renderOrderItemsCell(items: PurchaseOrderWithItems["items"]) {
  const names = (items ?? []).map((item) => item.materialName).filter(Boolean);
  if (names.length === 0) return <span className="text-muted-foreground">-</span>;

  return (
    <ul className="space-y-1">
      {names.map((name, index) => (
        <li key={`${name}-${index}`} className="whitespace-normal break-words leading-snug" title={name}>
          {name}
        </li>
      ))}
    </ul>
  );
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
  return { clientId: nanoid(), materialId: null, materialName: "", description: "", qtyOrdered: "1" };
}

function SortablePurchaseOrderRow({
  order,
  canWrite,
  cancelMutation,
  cancelingOrderId,
  setCancelingOrderId,
  openEditDialog,
  openReceiveDialog,
}: {
  order: PurchaseOrderWithItems;
  canWrite: boolean;
  cancelMutation: ReturnType<typeof useCancelPurchaseOrder>;
  cancelingOrderId: number | null;
  setCancelingOrderId: (id: number | null) => void;
  openEditDialog: (order: PurchaseOrderWithItems) => void;
  openReceiveDialog: (order: PurchaseOrderWithItems) => void;
}) {
  const canEdit = order.status !== "RECEIVED" && order.status !== "CANCELED";
  const canReceive = order.status !== "RECEIVED" && order.status !== "CANCELED";
  const canCancel = order.status !== "RECEIVED" && order.status !== "CANCELED";

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(order.id),
    disabled: !canWrite,
  });

  const style = {
    ...(transform ? { transform: CSS.Transform.toString(transform) } : {}),
    ...(transition ? { transition } : {}),
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? "bg-muted/40 shadow-sm ring-2 ring-primary/20" : undefined}
    >
      <TableCell className="w-10 px-0 sm:px-2">
        <button
          type="button"
          className={`touch-none inline-flex h-9 w-9 items-center justify-center rounded-md bg-black/5 text-muted-foreground hover:bg-black/10 active:bg-black/15 ${canWrite ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-50"}`}
          aria-label="Reordenar ordem de compra"
          {...attributes}
          {...listeners}
          disabled={!canWrite}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>

      <TableCell className="whitespace-normal">
        {renderOrderItemsCell(order.items)}
      </TableCell>
      <TableCell>{statusLabels[order.status]}</TableCell>
      <TableCell className="hidden md:table-cell">{formatDate(order.createdAt)}</TableCell>
      <TableCell className="hidden md:table-cell">{formatDate(order.receivedAt)}</TableCell>
      <TableCell className="text-right">
        {canWrite ? (
          <>
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
                onClick={() => {
                  setCancelingOrderId(order.id);
                  cancelMutation.mutate(order.id, {
                    onSettled: () => setCancelingOrderId(null),
                  });
                }}
              >
                {cancelMutation.isPending && cancelingOrderId === order.id ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cancelando...</>
                ) : "Cancelar"}
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
                    onSelect={() => {
                      setCancelingOrderId(order.id);
                      cancelMutation.mutate(order.id, {
                        onSettled: () => setCancelingOrderId(null),
                      });
                    }}
                  >
                    Cancelar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function SortableFormItem({
  item,
  index,
  canWrite,
  activeMaterials,
  onPatch,
  onRemove,
}: {
  item: PurchaseOrderFormItem;
  index: number;
  canWrite: boolean;
  activeMaterials: Material[];
  onPatch: (patch: Partial<PurchaseOrderFormItem>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.clientId,
    disabled: !canWrite,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`space-y-3 rounded-none border-0 p-0 md:rounded-lg md:border md:p-4 ${isDragging ? "bg-muted/40 shadow-lg ring-2 ring-primary/20" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`touch-none inline-flex h-9 w-9 items-center justify-center rounded-md bg-black/5 text-muted-foreground hover:bg-black/10 active:bg-black/15 ${canWrite ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-50"}`}
            aria-label="Reordenar item"
            {...attributes}
            {...listeners}
            disabled={!canWrite}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <h3 className="text-sm font-semibold">Item {index + 1}</h3>
        </div>

        <Button type="button" variant="ghost" size="icon" aria-label="Remover item" onClick={onRemove} disabled={!canWrite}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),180px]">
        <div className="space-y-2">
          <Label>Material</Label>
          <MaterialSelectField
            materials={activeMaterials}
            value={{ materialId: item.materialId ?? null, materialName: item.materialName }}
            onChange={(next) => onPatch({ materialId: next.materialId, materialName: next.materialName })}
          />
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Input
              value={item.description ?? ""}
              onChange={(e) => onPatch({ description: e.target.value })}
              placeholder="Ex.: link do fornecedor, WhatsApp, loja..."
              className="h-11 rounded-xl border-border bg-card px-4"
              disabled={!canWrite}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Qtd pedida (opcional)</Label>
          <Input
            inputMode="decimal"
            value={toPtBrDecimal(item.qtyOrdered)}
            onChange={(e) => onPatch({ qtyOrdered: fromPtBrDecimal(e.target.value, 3) })}
            placeholder="0,000"
            className="h-11 rounded-xl border-border bg-card px-4"
          />
        </div>
      </div>

      {!item.materialId ? (
        <p className="text-xs text-muted-foreground">
          Dica: digite no campo acima e selecione “Usar …” para texto livre.
        </p>
      ) : null}
    </div>
  );
}

function isStockTrackedMaterial(materials: Material[] | undefined, materialId: number | null | undefined): boolean {
  if (!materialId) return true;
  return materials?.find((material) => material.id === materialId)?.stockTracked !== false;
}

export default function PurchaseOrders() {
  const { data: orders, isLoading, error, refetch } = usePurchaseOrders();
  const { data: materials } = useMaterials();
  const createMutation = useCreatePurchaseOrder();
  const updateMutation = useUpdatePurchaseOrder();
  const receiveMutation = useReceivePurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();
  const reorderMutation = useReorderPurchaseOrders();
  const { toast } = useToast();
  const { canWrite } = useAuthz();

  const activeMaterials = useMemo(() => (materials ?? []).filter((m) => m.isActive === 1), [materials]);
  const materialById = useMemo(() => new Map((materials ?? []).map((material) => [material.id, material])), [materials]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderWithItems | null>(null);
  const [formItems, setFormItems] = useState<PurchaseOrderFormItem[]>([createEmptyItem()]);
  const [orderedOrders, setOrderedOrders] = useState<PurchaseOrderWithItems[]>([]);
  const [bulkCreating, setBulkCreating] = useState(false);

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrderWithItems | null>(null);
  const [receiveLines, setReceiveLines] = useState<ReceiveLine[]>([]);
  const [confirmReceiveWithoutStockOpen, setConfirmReceiveWithoutStockOpen] = useState(false);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [materialDialogName, setMaterialDialogName] = useState("");
  const [materialDialogTargetItemId, setMaterialDialogTargetItemId] = useState<number | null>(null);
  const [materialDialogHideInitialStockField, setMaterialDialogHideInitialStockField] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<number | null>(null);

  const isSavingOrder = bulkCreating || createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    setOrderedOrders(orders ?? []);
  }, [orders]);

  useEffect(() => {
    if (!dialogOpen) return;
    if (!editingOrder) {
      setFormItems([createEmptyItem()]);
      return;
    }

    setFormItems(
      editingOrder.items.map((item) => ({
        clientId: String(item.id),
        id: item.id,
        materialId: item.materialId ?? null,
        materialName: item.materialName,
        description: (item as any).description ?? "",
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
    if (!canWrite) return;
    setEditingOrder(null);
    setDialogOpen(true);
  };

  const openEditDialog = (order: PurchaseOrderWithItems) => {
    if (!canWrite) return;
    setEditingOrder(order);
    setDialogOpen(true);
  };

  const openReceiveDialog = (order: PurchaseOrderWithItems) => {
    if (!canWrite) return;
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
    if (!canWrite) {
      toast({ title: "Sem permissão", description: "Seu usuário não pode criar/editar ordens de compra.", variant: "destructive" });
      return;
    }

    const payloadItems = formItems.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      materialId: item.materialId ?? null,
      materialName: item.materialName,
      description: item.description?.trim() ? item.description.trim() : null,
      qtyOrdered: item.qtyOrdered?.trim() ? item.qtyOrdered : undefined,
    }));

    if (editingOrder) {
      if (editingOrder.status === "OPEN" && payloadItems.length > 1) {
        setBulkCreating(true);
        (async () => {
          try {
            const [first, ...rest] = payloadItems;
            if (!first) return;

            await updateMutation.mutateAsync({ id: editingOrder.id, data: { items: [first] } });

            for (const item of rest) {
              const { id: _id, ...createItem } = item;
              await createMutation.mutateAsync({ items: [createItem] });
            }

            toast({ title: "Sucesso", description: `Itens separados em ${payloadItems.length} ordens de compra.` });
            setDialogOpen(false);
            setEditingOrder(null);
          } finally {
            setBulkCreating(false);
          }
        })().catch(() => {});
        return;
      }

      updateMutation.mutate(
        { id: editingOrder.id, data: { items: payloadItems } },
        {
          onSuccess: () => {
            toast({ title: "Sucesso", description: "Ordem de compra atualizada com sucesso." });
            setDialogOpen(false);
            setEditingOrder(null);
          },
        },
      );
      return;
    }

    const createItems = payloadItems.map(({ id: _id, ...rest }) => rest);

    if (createItems.length === 0) return;

    if (createItems.length === 1) {
      createMutation.mutate(
        { items: createItems },
        {
          onSuccess: () => {
            toast({ title: "Sucesso", description: "Ordem de compra criada com sucesso." });
            setDialogOpen(false);
          },
        },
      );
      return;
    }

    setBulkCreating(true);
    (async () => {
      try {
        for (const item of createItems) {
          await createMutation.mutateAsync({ items: [item] });
        }
        toast({ title: "Sucesso", description: `${createItems.length} ordens de compra criadas com sucesso.` });
        setDialogOpen(false);
      } finally {
        setBulkCreating(false);
      }
    })().catch(() => {});
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } }),
  );

  const handleItemsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFormItems((current) => {
      const oldIndex = current.findIndex((i) => i.clientId === active.id);
      const newIndex = current.findIndex((i) => i.clientId === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  };

  const handleOrdersDragEnd = (event: DragEndEvent) => {
    if (!canWrite) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedOrders((current) => {
      const oldIndex = current.findIndex((o) => String(o.id) === active.id);
      const newIndex = current.findIndex((o) => String(o.id) === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;

      const next = arrayMove(current, oldIndex, newIndex);
      reorderMutation.mutate(
        { orderedIds: next.map((o) => o.id) },
        {
          onError: () => setOrderedOrders(current),
        },
      );
      return next;
    });
  };

  const updateReceiveLine = (itemId: number, patch: Partial<ReceiveLine>) => {
    setReceiveLines((current) => current.map((line) => (line.id === itemId ? { ...line, ...patch } : line)));
  };

  const hasReceiveWithoutStock = useMemo(() => {
    if (!receivingOrder) return false;
    return receiveLines.some((line) => {
      const orderItem = receivingOrder.items.find((i) => i.id === line.id);
      if (!orderItem) return false;
      const effectiveMaterialId = orderItem.materialId ?? line.materialId ?? null;
      const material = materialById.get(effectiveMaterialId ?? -1);
      const isTracked = material?.stockTracked !== false;
      const qty = Number(line.qtyReceiveNow);
      if (!qty || qty <= 0) return false;
      if (!isTracked) return false;
      return !effectiveMaterialId;
    });
  }, [materialById, receiveLines, receivingOrder]);

  const submitReceive = () => {
    if (!canWrite) {
      toast({ title: "Sem permissão", description: "Seu usuário não pode receber ordens de compra.", variant: "destructive" });
      return;
    }
    if (!receivingOrder) return;

    const linesToSend = receiveLines
      .map((line) => {
        const orderItem = receivingOrder.items.find((item) => item.id === line.id);
        const effectiveMaterialId = orderItem?.materialId ?? line.materialId ?? null;
        const isTracked = isStockTrackedMaterial(materials, effectiveMaterialId);
        const qtyReceiveNow = line.qtyReceiveNow?.trim();
        return {
          ...line,
          qtyReceiveNow: qtyReceiveNow ? qtyReceiveNow : isTracked ? "" : undefined,
          materialName: line.materialName?.trim() ? line.materialName.trim() : undefined,
          qtyOrdered: line.qtyOrdered?.trim() ? line.qtyOrdered.trim() : undefined,
          isTracked,
        };
      })
      .filter((line) => line.isTracked ? Number(line.qtyReceiveNow) > 0 : true);

    if (linesToSend.length === 0) return;

    if (hasReceiveWithoutStock) {
      setConfirmReceiveWithoutStockOpen(true);
      return;
    }

    receiveMutation.mutate(
      { id: receivingOrder.id, data: { items: linesToSend.map((l) => ({ id: l.id, qtyReceiveNow: l.isTracked ? l.qtyReceiveNow : undefined, materialId: l.materialId ?? null, materialName: l.materialName, qtyOrdered: l.qtyOrdered })) } },
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
      .map((line) => {
        const orderItem = receivingOrder.items.find((item) => item.id === line.id);
        const effectiveMaterialId = orderItem?.materialId ?? line.materialId ?? null;
        const isTracked = isStockTrackedMaterial(materials, effectiveMaterialId);
        const qtyReceiveNow = line.qtyReceiveNow?.trim();
        return {
          ...line,
          qtyReceiveNow: qtyReceiveNow ? qtyReceiveNow : isTracked ? "" : undefined,
          materialName: line.materialName?.trim() ? line.materialName.trim() : undefined,
          qtyOrdered: line.qtyOrdered?.trim() ? line.qtyOrdered.trim() : undefined,
          isTracked,
        };
      })
      .filter((line) => line.isTracked ? Number(line.qtyReceiveNow) > 0 : true);

    receiveMutation.mutate(
      { id: receivingOrder.id, data: { items: linesToSend.map((l) => ({ id: l.id, qtyReceiveNow: l.isTracked ? l.qtyReceiveNow : undefined, materialId: l.materialId ?? null, materialName: l.materialName, qtyOrdered: l.qtyOrdered })) } },
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
    setMaterialDialogHideInitialStockField(true);
    setMaterialDialogOpen(true);
  };

  const onMaterialCreated = (created: Material[]) => {
    const first = created[0];
    if (!first || materialDialogTargetItemId === null) return;
    updateReceiveLine(materialDialogTargetItemId, { materialId: first.id, materialName: first.name });
    toast({
      title: "Material criado",
      description: `Material ${first.name} vinculado ao item da ordem.`,
    });
    setMaterialDialogHideInitialStockField(false);
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-primary" />
          Ordens de Compra
        </h1>

        <Button onClick={openCreateDialog} disabled={!canWrite || isSavingOrder}>
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
      ) : orderedOrders.length ? (
        <>
          <div className="space-y-3 md:hidden">
            {orderedOrders.map((order) => {
              const itemNames = (order.items ?? []).map((item) => item.materialName).filter(Boolean);
              const canEdit = order.status !== "RECEIVED" && order.status !== "CANCELED";
              const canReceive = order.status !== "RECEIVED" && order.status !== "CANCELED";
              const canCancel = order.status !== "RECEIVED" && order.status !== "CANCELED";

              return (
                <Card key={order.id} className="border-border/70 bg-card/90 shadow-none">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs text-muted-foreground">OC #{order.id}</p>
                        <p className="line-clamp-2 text-sm font-semibold text-foreground">
                          {itemNames.length ? itemNames.join(", ") : "Sem itens informados"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">{statusLabels[order.status]}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl bg-muted/40 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">Criada</p>
                        <p className="font-medium text-foreground">{formatDate(order.createdAt)}</p>
                      </div>
                      <div className="rounded-xl bg-muted/40 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">Recebida</p>
                        <p className="font-medium text-foreground">{formatDate(order.receivedAt)}</p>
                      </div>
                    </div>

                    {canWrite ? (
                      <div className="grid grid-cols-3 gap-2">
                        <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => openEditDialog(order)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="outline" disabled={!canReceive} onClick={() => openReceiveDialog(order)}>
                          Receber
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!canCancel || cancelMutation.isPending}
                          onClick={() => {
                            setCancelingOrderId(order.id);
                            cancelMutation.mutate(order.id, {
                              onSettled: () => setCancelingOrderId(null),
                            });
                          }}
                        >
                          {cancelMutation.isPending && cancelingOrderId === order.id ? "..." : "Cancelar"}
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" aria-label="Ordenação" />
                  <TableHead>Itens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Criada em</TableHead>
                  <TableHead className="hidden md:table-cell">Recebida em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleOrdersDragEnd}>
                <SortableContext items={orderedOrders.map((o) => String(o.id))} strategy={verticalListSortingStrategy}>
                  <TableBody>
                    {orderedOrders.map((order) => (
                      <SortablePurchaseOrderRow
                        key={order.id}
                        order={order}
                        canWrite={canWrite && !reorderMutation.isPending}
                        cancelMutation={cancelMutation}
                        cancelingOrderId={cancelingOrderId}
                        setCancelingOrderId={setCancelingOrderId}
                        openEditDialog={openEditDialog}
                        openReceiveDialog={openReceiveDialog}
                      />
                    ))}
                  </TableBody>
                </SortableContext>
              </DndContext>
            </Table>
          </div>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Comece criando sua primeira ordem de compra</CardTitle>
            <CardDescription>Crie itens por material ou texto livre e registre recebimentos parciais.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openCreateDialog} disabled={!canWrite || isSavingOrder}>
              <Plus className="w-4 h-4 mr-2" /> Nova Ordem
            </Button>
          </CardContent>
        </Card>
      )}

      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent className="max-w-3xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">{editingOrder ? `Editar OC #${editingOrder.id}` : "Nova Ordem de Compra"}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="text-sm text-foreground/75">
              {editingOrder
                ? "Edite o item e a quantidade. Selecione um material ou informe o nome livre."
                : "Adicione um ou mais itens. Ao salvar, cada item vira uma ordem separada na lista para edição individual."}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <form onSubmit={submitOrder} className="flex min-h-[320px] flex-col gap-4">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemsDragEnd}>
                <SortableContext items={formItems.map((i) => i.clientId)} strategy={verticalListSortingStrategy}>
                  {formItems.map((item, index) => (
                    <SortableFormItem
                      key={item.clientId}
                      item={item}
                      index={index}
                      canWrite={canWrite}
                      activeMaterials={activeMaterials}
                      onPatch={(patch) => updateFormItem(index, patch)}
                      onRemove={() => removeFormItem(index)}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              <button
                type="button"
                onClick={addFormItem}
                disabled={!canWrite || isSavingOrder}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="h-4 w-4" />
                Adicionar item
              </button>
            </div>

            <ResponsiveDialogFooter className="justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!canWrite || isSavingOrder}>
                {isSavingOrder ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {editingOrder ? "Salvando..." : "Criando..."}</>
                ) : (editingOrder ? "Salvar" : "Criar")}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <ResponsiveDialogContent className="max-w-3xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">{receivingOrder ? `Receber itens da OC #${receivingOrder.id}` : "Receber ordem de compra"}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="text-sm text-foreground/75">Informe “Receber agora”. Para itens sem material, você pode vincular/criar um material antes de confirmar.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="flex min-h-[320px] flex-col gap-4">
            {receivingOrder ? (
              <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                {receivingOrder.items.map((item) => {
                  const line = receiveLines.find((l) => l.id === item.id);
                  const remaining = Number(item.qtyOrdered) - Number(item.qtyReceived);
                  const currentMaterialId = item.materialId ?? line?.materialId ?? null;
                  const currentMaterialName = item.materialId ? item.materialName : line?.materialName ?? item.materialName;
                  const currentMaterial = currentMaterialId ? materialById.get(currentMaterialId) : undefined;
                  const isTracked = currentMaterial?.stockTracked !== false;
                  return (
                    <div key={item.id} className="space-y-3 rounded-none border-0 p-0 md:rounded-lg md:border md:p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold">{item.materialName}</div>
                          <div className="text-xs text-muted-foreground">
                            Pedido: {item.qtyOrdered} · Já recebido: {item.qtyReceived} · Restante: {remaining.toFixed(3)}
                          </div>
                          {!isTracked ? (
                            <div className="mt-1 text-xs font-medium text-muted-foreground">
                              Sem controle de estoque: recebimento sem quantidade.
                            </div>
                          ) : null}
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
                          {isTracked ? (
                            <Input
                              inputMode="decimal"
                              value={toPtBrDecimal(line?.qtyReceiveNow ?? "")}
                              onChange={(e) => updateReceiveLine(item.id, { qtyReceiveNow: fromPtBrDecimal(e.target.value, 3) })}
                              placeholder="0,000"
                              className="h-11 rounded-xl border-border bg-card px-4"
                            />
                          ) : (
                            <div className="rounded-xl border-0 bg-muted/20 px-4 py-3 text-sm text-muted-foreground md:border md:border-dashed md:border-border">
                              Não é necessário informar quantidade.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Qtd pedida (opcional)</Label>
                          <Input
                            inputMode="decimal"
                            value={toPtBrDecimal(line?.qtyOrdered ?? String(item.qtyOrdered))}
                            onChange={(e) => updateReceiveLine(item.id, { qtyOrdered: fromPtBrDecimal(e.target.value, 3) })}
                            placeholder="0,000"
                            className="h-11 rounded-xl border-border bg-card px-4"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Nome (opcional)</Label>
                          <Input
                            value={line?.materialName ?? item.materialName}
                            onChange={(e) => updateReceiveLine(item.id, { materialName: e.target.value })}
                            disabled={Boolean(currentMaterialId)}
                            className="h-11 rounded-xl border-border bg-card px-4"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <ResponsiveDialogFooter className="justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReceiveOpen(false)}>
                Fechar
              </Button>
              <Button type="button" onClick={submitReceive} disabled={!canWrite || receiveMutation.isPending}>
                {receiveMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirmando...</>
                ) : "Confirmar recebimento"}
              </Button>
            </ResponsiveDialogFooter>
          </div>
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
            <AlertDialogAction onClick={confirmReceiveWithoutStock} disabled={receiveMutation.isPending}>
              {receiveMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
              ) : "Continuar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MaterialDialog
        open={materialDialogOpen}
        onOpenChange={(open) => {
          setMaterialDialogOpen(open);
          if (!open) {
            setMaterialDialogTargetItemId(null);
            setMaterialDialogHideInitialStockField(false);
          }
        }}
        initialName={materialDialogName}
        allowMultiple={false}
        title="Criar material"
        description="Crie o material para vincular ao item recebido. Depois disso, o recebimento pode atualizar o estoque."
        onCreated={onMaterialCreated}
        hideInitialStockField={materialDialogHideInitialStockField}
      />
    </Layout>
  );
}
