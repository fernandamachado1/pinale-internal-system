import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { closestCorners, DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ProductionOrderWithProduct } from "@shared/schema";
import { Layout } from "@/components/Layout";
import { useConcludeProductionOrder, useCreateProductionOrder, useMaterials, useMoveProductionOrder, useProducts, useProductionOrders } from "@/hooks/use-erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription as UiCardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Factory, GripVertical, Package, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatQty } from "@/lib/format";

type ProductionKanbanStatus = ProductionOrderWithProduct["status"];
type ActiveProductionKanbanStatus = Exclude<ProductionKanbanStatus, "DONE">;
type ProductionBoardState = Record<ProductionKanbanStatus, ProductionOrderWithProduct[]>;

const columnOrder: ProductionKanbanStatus[] = ["BACKLOG", "IN_PROGRESS", "DONE"];

const columnMeta: Record<ProductionKanbanStatus, { title: string; description: string }> = {
  BACKLOG: {
    title: "Backlog",
    description: "Ordens prontas para entrar em produção.",
  },
  IN_PROGRESS: {
    title: "Em produção",
    description: "Ordens sendo executadas no momento.",
  },
  DONE: {
    title: "Concluído",
    description: "Ordens finalizadas e enviadas ao estoque.",
  },
};

const columnTheme: Record<ProductionKanbanStatus, { shell: string; accent: string; badge: string; empty: string; card: string }> = {
  BACKLOG: {
    shell: "border-stone-200 bg-stone-50/80",
    accent: "bg-stone-500",
    badge: "border-stone-300 bg-stone-100 text-stone-800",
    empty: "border-stone-200 bg-white/80 text-stone-500",
    card: "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/80",
  },
  IN_PROGRESS: {
    shell: "border-slate-200 bg-slate-50/80",
    accent: "bg-slate-500",
    badge: "border-slate-300 bg-slate-100 text-slate-800",
    empty: "border-slate-200 bg-white/80 text-slate-500",
    card: "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80",
  },
  DONE: {
    shell: "border-zinc-200 bg-zinc-50/80",
    accent: "bg-zinc-500",
    badge: "border-zinc-300 bg-zinc-100 text-zinc-800",
    empty: "border-zinc-200 bg-white/80 text-zinc-500",
    card: "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/80",
  },
};

const statusLabels: Record<ProductionKanbanStatus, string> = {
  BACKLOG: "Backlog",
  IN_PROGRESS: "Em produção",
  DONE: "Concluído",
};

function createBoardState(orders: ProductionOrderWithProduct[] | undefined): ProductionBoardState {
  const emptyBoard: ProductionBoardState = {
    BACKLOG: [],
    IN_PROGRESS: [],
    DONE: [],
  };

  if (!orders) return emptyBoard;

  return orders.reduce<ProductionBoardState>((board, order) => {
    board[order.status].push(order);
    return board;
  }, emptyBoard);
}

function findOrder(board: ProductionBoardState, orderId: number): ProductionOrderWithProduct | undefined {
  return columnOrder.flatMap((status) => board[status]).find((order) => order.id === orderId);
}

function findStatusByOrderId(board: ProductionBoardState, orderId: number): ProductionKanbanStatus | undefined {
  return columnOrder.find((status) => board[status].some((order) => order.id === orderId));
}

function resolveDropTargetStatus(board: ProductionBoardState, overId: string): ProductionKanbanStatus | undefined {
  if (columnOrder.includes(overId as ProductionKanbanStatus)) {
    return overId as ProductionKanbanStatus;
  }

  const orderId = Number(overId);
  if (Number.isNaN(orderId)) return undefined;
  return findStatusByOrderId(board, orderId);
}

function moveOrderOnBoard(
  board: ProductionBoardState,
  activeId: number,
  overId: string,
): { nextBoard: ProductionBoardState; destinationStatus: ProductionKanbanStatus } | null {
  const sourceStatus = findStatusByOrderId(board, activeId);
  const destinationStatus = resolveDropTargetStatus(board, overId);
  const activeOrder = findOrder(board, activeId);

  if (!sourceStatus || !destinationStatus || !activeOrder) return null;

  const sourceItems = [...board[sourceStatus]];
  const sourceIndex = sourceItems.findIndex((order) => order.id === activeId);
  if (sourceIndex === -1) return null;

  const movingOrder = sourceItems[sourceIndex];

  if (sourceStatus === destinationStatus) {
    const overIndex = columnOrder.includes(overId as ProductionKanbanStatus)
      ? sourceItems.length - 1
      : sourceItems.findIndex((order) => order.id === Number(overId));

    if (overIndex === -1 || overIndex === sourceIndex) return null;

    return {
      destinationStatus,
      nextBoard: {
        ...board,
        [sourceStatus]: arrayMove(sourceItems, sourceIndex, overIndex),
      },
    };
  }

  const nextSourceItems = sourceItems.filter((order) => order.id !== activeId);
  const destinationItems = [...board[destinationStatus]];
  const overIndex = destinationStatus === "DONE"
    ? destinationItems.length
    : columnOrder.includes(overId as ProductionKanbanStatus)
      ? destinationItems.length
      : destinationItems.findIndex((order) => order.id === Number(overId));

  destinationItems.splice(overIndex === -1 ? destinationItems.length : overIndex, 0, {
    ...movingOrder,
    status: destinationStatus,
  });

  return {
    destinationStatus,
    nextBoard: {
      ...board,
      [sourceStatus]: nextSourceItems,
      [destinationStatus]: destinationItems,
    },
  };
}

function ProductionCardBody({ order, dragHandle }: { order: ProductionOrderWithProduct; dragHandle?: ReactNode }) {
  const theme = columnTheme[order.status];

  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold">OP #{order.id}</div>
          <div className="text-sm text-muted-foreground">{order.product.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={theme.badge}>{statusLabels[order.status]}</Badge>
          {dragHandle}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Package className="h-4 w-4" />
          <span>{order.qtyPlanned} unidade(s)</span>
        </div>
        <div className="text-muted-foreground">
          Criada em {format(new Date(order.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
      </div>
    </>
  );
}

function ProductionCard({ order, dragDisabled }: { order: ProductionOrderWithProduct; dragDisabled: boolean }) {
  const theme = columnTheme[order.status];
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: String(order.id),
    disabled: dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border p-4 shadow-sm transition-[transform,box-shadow,border-color,background-color] ${theme.card} ${dragDisabled ? "" : "cursor-grab active:cursor-grabbing"} ${isDragging ? "shadow-xl ring-2 ring-primary/30" : ""}`}
      {...(!dragDisabled ? attributes : {})}
      {...(!dragDisabled ? listeners : {})}
    >
      <ProductionCardBody
        order={order}
        dragHandle={!dragDisabled ? (
          <div className="rounded-md bg-black/5 p-1 text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </div>
        ) : undefined}
      />
    </article>
  );
}

function ColumnDropZone({
  status,
  orders,
  children,
}: {
  status: ProductionKanbanStatus;
  orders: ProductionOrderWithProduct[];
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const theme = columnTheme[status];

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-[360px] flex-col rounded-2xl border p-4 transition-colors ${theme.shell} ${isOver ? "border-primary shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]" : ""}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className={`mb-2 h-1.5 w-14 rounded-full ${theme.accent}`} />
          <h2 className="text-base font-semibold">{columnMeta[status].title}</h2>
          <p className="text-sm text-muted-foreground">{columnMeta[status].description}</p>
        </div>
        <Badge className={theme.badge}>{orders.length}</Badge>
      </div>

      <SortableContext id={status} items={orders.map((order) => String(order.id))} strategy={rectSortingStrategy}>
        <div className="flex flex-1 flex-col gap-3">
          {orders.length > 0 ? children : <div className={`flex flex-1 items-center justify-center rounded-xl border border-dashed p-6 text-sm ${theme.empty}`}>Nenhuma OP nesta etapa.</div>}
        </div>
      </SortableContext>
    </section>
  );
}

export default function Production() {
  const { toast } = useToast();
  const { data: orders, isLoading: isOrdersLoading, error: ordersError, refetch: refetchOrders } = useProductionOrders();
  const { data: products } = useProducts();
  const { data: materials } = useMaterials();
  const createMutation = useCreateProductionOrder();
  const moveMutation = useMoveProductionOrder();
  const concludeMutation = useConcludeProductionOrder();

  const activeProducts = useMemo(() => products?.filter((product) => product.isActive === 1) ?? [], [products]);
  const [boardState, setBoardState] = useState<ProductionBoardState>(createBoardState(undefined));
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [pendingCompletion, setPendingCompletion] = useState<{
    orderId: number;
    previousBoard: ProductionBoardState;
    nextBoard: ProductionBoardState;
  } | null>(null);
  const [pendingStart, setPendingStart] = useState<{
    orderId: number;
    previousBoard: ProductionBoardState;
    nextBoard: ProductionBoardState;
    orderedIds: number[];
  } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [qtyPlanned, setQtyPlanned] = useState("1");

  useEffect(() => {
    setBoardState(createBoardState(orders));
  }, [orders]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const selectedProduct = useMemo(() => activeProducts.find((product) => String(product.id) === productId), [activeProducts, productId]);
  const activeOrder = activeOrderId !== null ? findOrder(boardState, activeOrderId) : null;
  const interactionsDisabled = moveMutation.isPending || concludeMutation.isPending || pendingCompletion !== null || pendingStart !== null;

  const productById = useMemo(() => new Map((products ?? []).map((product) => [product.id, product])), [products]);
  const materialById = useMemo(() => new Map((materials ?? []).map((material) => [material.id, material])), [materials]);

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    createMutation.mutate(
      { productId: Number(productId), qtyPlanned: Number(qtyPlanned) },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setProductId("");
          setQtyPlanned("1");
        },
      },
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    const nextOrderId = Number(event.active.id);
    if (!Number.isNaN(nextOrderId)) setActiveOrderId(nextOrderId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveOrderId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = Number(active.id);
    if (Number.isNaN(activeId)) return;

    const sourceStatus = findStatusByOrderId(boardState, activeId);
    if (!sourceStatus || sourceStatus === "DONE") return;

    const result = moveOrderOnBoard(boardState, activeId, String(over.id));
    if (!result) return;

    const { destinationStatus, nextBoard } = result;
    const previousBoard = boardState;

    if (sourceStatus === "IN_PROGRESS" && destinationStatus === "BACKLOG") {
      toast({
        title: "Movimento não permitido",
        description: "Ordens que já iniciaram produção não podem voltar para o backlog porque os materiais já foram baixados.",
        variant: "destructive",
      });
      return;
    }

    setBoardState(nextBoard);

    if (destinationStatus === "DONE") {
      setPendingCompletion({ orderId: activeId, previousBoard, nextBoard });
      return;
    }

    if (sourceStatus === "BACKLOG" && destinationStatus === "IN_PROGRESS") {
      setPendingStart({
        orderId: activeId,
        previousBoard,
        nextBoard,
        orderedIds: nextBoard[destinationStatus].map((order) => order.id),
      });
      return;
    }

    moveMutation.mutate(
      {
        id: activeId,
        data: {
          status: destinationStatus as ActiveProductionKanbanStatus,
          orderedIds: nextBoard[destinationStatus].map((order) => order.id),
        },
      },
      {
        onError: () => {
          setBoardState(previousBoard);
        },
      },
    );
  };

  const handleCompletionCancel = () => {
    if (pendingCompletion) {
      setBoardState(pendingCompletion.previousBoard);
      setPendingCompletion(null);
    }
  };

  const handleCompletionConfirm = () => {
    if (!pendingCompletion) return;

    const orderId = pendingCompletion.orderId;
    concludeMutation.mutate(
      { id: orderId, data: {} },
      {
        onError: () => {
          setBoardState(pendingCompletion.previousBoard);
        },
        onSettled: () => {
          setPendingCompletion(null);
        },
      },
    );
  };

  const handleStartCancel = () => {
    if (pendingStart) {
      setBoardState(pendingStart.previousBoard);
      setPendingStart(null);
    }
  };

  const handleStartConfirm = () => {
    if (!pendingStart) return;
    const orderId = pendingStart.orderId;

    moveMutation.mutate(
      {
        id: orderId,
        data: {
          status: "IN_PROGRESS",
          orderedIds: pendingStart.orderedIds,
        },
      },
      {
        onError: () => setBoardState(pendingStart.previousBoard),
        onSettled: () => setPendingStart(null),
      },
    );
  };

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <Factory className="h-8 w-8 text-primary" />
          Ordens de Produção
        </h1>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nova OP
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Ordem de Produção</DialogTitle>
              <DialogDescription>A nova OP entra no backlog. Os materiais serão baixados quando ela entrar em produção.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {activeProducts.map((product) => (
                      <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantidade planejada</Label>
                <Input type="number" min="1" value={qtyPlanned} onChange={(e) => setQtyPlanned(e.target.value)} />
              </div>

              {selectedProduct ? (
                <div className="space-y-1 rounded border p-3 text-sm">
                  <div><strong>Entrada inicial:</strong> Backlog</div>
                  <div><strong>Baixa de materiais:</strong> ao mover para Em produção</div>
                  <div><strong>Materiais na ficha:</strong> {selectedProduct.bomItems.length}</div>
                  <div><strong>Quantidade planejada:</strong> {qtyPlanned}</div>
                </div>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || !productId}>Criar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {ordersError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Não foi possível carregar as ordens</AlertTitle>
          <AlertDescription>
            Verifique se o servidor e o banco estão rodando e tente novamente.
            <div className="mt-3">
              <Button variant="outline" onClick={() => refetchOrders()}>
                Tentar novamente
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {isOrdersLoading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="rounded-2xl">
              <CardHeader>
                <CardTitle><Skeleton className="h-4 w-24" /></CardTitle>
                <UiCardDescription><Skeleton className="h-3 w-48" /></UiCardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {Array.from({ length: 4 }).map((__, rowIndex) => (
                  <Skeleton key={rowIndex} className="h-16 w-full rounded-xl" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : orders?.length ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {columnOrder.map((status) => (
              <ColumnDropZone key={status} status={status} orders={boardState[status]}>
                {boardState[status].map((order) => (
                  <ProductionCard key={order.id} order={order} dragDisabled={interactionsDisabled || order.status === "DONE"} />
                ))}
              </ColumnDropZone>
            ))}
          </div>

          <DragOverlay>
            {activeOrder ? (
              <article className={`rounded-xl border p-4 shadow-xl ring-2 ring-primary/30 ${columnTheme[activeOrder.status].card}`}>
                <ProductionCardBody order={activeOrder} />
              </article>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma OP criada</CardTitle>
            <UiCardDescription>Crie uma ordem para acompanhar backlog, produção e conclusão.</UiCardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nova OP
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={pendingStart !== null}
        onOpenChange={(open) => {
          if (!open) handleStartCancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar produção da OP #{pendingStart?.orderId}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStart ? (
                (() => {
                  const order = findOrder(pendingStart.nextBoard, pendingStart.orderId);
                  if (!order) return null;

                  const product = productById.get(order.productId);
                  const qty = order.qtyPlanned;
                  const items = product?.bomItems ?? [];

                  return (
                    <div className="space-y-2">
                      <div>
                        Ao mover para <strong>Em produção</strong>, os materiais serão baixados do estoque.
                      </div>
                      <div className="text-sm">
                        <strong>{order.product.name}</strong> — {qty} unidade(s)
                      </div>
                      {items.length ? (
                        <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
                          <div className="mb-2 font-semibold">Consumo previsto</div>
                          <ul className="space-y-1">
                            {items.map((bomItem) => {
                              const material = materialById.get(bomItem.materialId);
                              const perUnit = Number(bomItem.qtyPerUnit);
                              const total = perUnit * qty;
                              return (
                                <li key={bomItem.id} className="flex items-center justify-between gap-3">
                                  <span className="min-w-0 truncate">
                                    {material?.name ?? `Material #${bomItem.materialId}`}
                                  </span>
                                  <span className="shrink-0 text-muted-foreground">
                                    {formatQty(total)} {material?.unitOfMeasure === "SQUARE_METER" ? "m²" : material?.unitOfMeasure === "METER" ? "m" : "un"}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Não foi possível calcular o consumo (lista de produtos/materiais ainda não carregou).
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStartCancel}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartConfirm} disabled={moveMutation.isPending}>
              Iniciar produção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingCompletion !== null} onOpenChange={(open) => {
        if (!open) handleCompletionCancel();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir OP #{pendingCompletion?.orderId}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCompletion ? (
                <>
                  Finaliza a OP e envia{" "}
                  <strong>{findOrder(pendingCompletion.nextBoard, pendingCompletion.orderId)?.qtyPlanned ?? 0} unidade(s)</strong> para o estoque produzido.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCompletionCancel}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompletionConfirm} disabled={concludeMutation.isPending}>Concluir OP</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
