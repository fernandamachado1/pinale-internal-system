import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { closestCorners, DndContext, DragOverlay, MouseSensor, pointerWithin, TouchSensor, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragMoveEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ProductionOrderWithProduct } from "@shared/schema";
import { Layout } from "@/components/Layout";
import { useConcludeProductionOrder, useCreateProductionOrder, useMaterials, useMoveProductionOrder, useProducts, useProductionOrders } from "@/hooks/use-erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription as UiCardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, Factory, GripVertical, Loader2, Package, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatQty } from "@/lib/format";
import { useAuthz } from "@/hooks/use-authz";
import { useIsMobile } from "@/hooks/use-mobile";

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
    shell: "border-border/70 bg-muted/20",
    accent: "bg-muted-foreground/25",
    badge: "border-transparent bg-foreground text-background",
    empty: "border-border/60 bg-card/60 text-muted-foreground",
    card: "border-border/60 bg-card hover:border-border hover:bg-accent/30",
  },
  IN_PROGRESS: {
    shell: "border-border/70 bg-muted/20",
    accent: "bg-primary/35",
    badge: "border-transparent bg-foreground text-background",
    empty: "border-border/60 bg-card/60 text-muted-foreground",
    card: "border-border/60 bg-card hover:border-border hover:bg-accent/30",
  },
  DONE: {
    shell: "border-border/70 bg-muted/20",
    accent: "bg-muted-foreground/25",
    badge: "border-transparent bg-foreground text-background",
    empty: "border-border/60 bg-card/60 text-muted-foreground",
    card: "border-border/60 bg-card hover:border-border hover:bg-accent/30",
  },
};

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args);
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

function ProductionCardBody({
  order,
  dragHandle,
  statusHint,
}: {
  order: ProductionOrderWithProduct;
  dragHandle?: ReactNode;
  statusHint?: ReactNode;
}) {
  const dueDate = order.dueAt ? new Date(order.dueAt as any) : null;
  const daysToDue = dueDate ? differenceInCalendarDays(startOfDay(dueDate), startOfDay(new Date())) : null;
  const isOverdue = order.status !== "DONE" && daysToDue !== null && daysToDue < 0;
  const isDueSoon = order.status !== "DONE" && daysToDue !== null && daysToDue >= 0 && daysToDue <= 3;
  const channelLabel = order.salesChannel === "PHYSICAL" ? "Físico" : "Online";
  const channelClass =
    order.salesChannel === "PHYSICAL"
      ? "border-transparent bg-slate-900 text-white"
      : "border-transparent bg-primary text-primary-foreground";
  const notes = order.customizationNotes?.trim();
  const hasMeasure = order.measureCm !== null && order.measureCm !== undefined && Number.isFinite(Number(order.measureCm));
  const measureLabel = hasMeasure ? `${Number(order.measureCm).toLocaleString("pt-BR")} cm` : null;
  const description = [notes, measureLabel ? `Medida: ${measureLabel}` : null].filter(Boolean).join(" | ");

  return (
    <>
      <div className="mb-2 flex items-start justify-between gap-3 sm:mb-3">
        <div className="space-y-1">
          <div className="text-xs font-semibold sm:text-sm">OP #{order.id}</div>
          <div className="text-xs text-muted-foreground sm:text-sm">{order.product.name}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <Badge className={`px-2 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-xs ${channelClass}`}>{channelLabel}</Badge>
          {isDueSoon ? <Badge className="border-transparent bg-yellow-400 px-2 py-0.5 text-[10px] text-yellow-950 sm:px-2.5 sm:py-1 sm:text-xs">A vencer</Badge> : null}
          {isOverdue ? <Badge className="border-transparent bg-red-600 px-2 py-0.5 text-[10px] text-white sm:px-2.5 sm:py-1 sm:text-xs">Vencida</Badge> : null}
          {dragHandle}
        </div>
      </div>

      <div className="space-y-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Package className="h-4 w-4" />
          <span>{order.qtyPlanned} unidade(s)</span>
        </div>
        {description ? (
          <div className="text-muted-foreground">
            <strong>Descrição:</strong> {description}
          </div>
        ) : null}
        {statusHint ? <div>{statusHint}</div> : null}
        <div className="text-[11px] text-muted-foreground">
          <span className="sm:hidden">Criada {format(new Date(order.createdAt), "dd/MM", { locale: ptBR })}</span>
          <span className="hidden sm:inline">
            Criada em {format(new Date(order.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
      </div>
    </>
  );
}

function ProductionCard({ order, dragDisabled, bomWarning }: { order: ProductionOrderWithProduct; dragDisabled: boolean; bomWarning: boolean }) {
  const theme = columnTheme[order.status];
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
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
      className={`min-h-[92px] rounded-xl border p-2.5 shadow-sm transition-[transform,box-shadow,border-color,background-color] sm:min-h-0 sm:p-4 ${theme.card} ${dragDisabled ? "" : "cursor-default"} ${isDragging ? "shadow-xl ring-2 ring-primary/30" : ""}`}
    >
      <ProductionCardBody
        order={order}
        statusHint={bomWarning ? <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700">Sem ficha técnica</span> : null}
        dragHandle={!dragDisabled ? (
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="touch-none flex h-9 w-9 items-center justify-center rounded-md bg-black/5 p-1.5 text-muted-foreground hover:bg-black/10 active:bg-black/15 cursor-grab active:cursor-grabbing sm:h-auto sm:w-auto sm:p-1"
            aria-label="Arrastar ordem de produção"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : undefined}
      />
    </article>
  );
}

function ColumnDropZone({
  status,
  orders,
  children,
  isActiveTarget,
}: {
  status: ProductionKanbanStatus;
  orders: ProductionOrderWithProduct[];
  children: ReactNode;
  isActiveTarget?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const theme = columnTheme[status];
  const visibleOrders = status === "DONE" ? [] : orders;

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-[260px] min-w-[82vw] flex-none snap-center flex-col rounded-2xl border p-2.5 transition-colors sm:min-h-[360px] sm:min-w-[320px] sm:snap-start sm:p-4 ${theme.shell} ${isOver || isActiveTarget ? "border-primary shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] ring-2 ring-primary/20" : ""}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className={`mb-2 h-1.5 w-14 rounded-full ${theme.accent}`} />
          <h2 className="text-sm font-semibold sm:text-base">{columnMeta[status].title}</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">{columnMeta[status].description}</p>
          {isActiveTarget ? <p className="mt-1 text-[11px] font-medium text-primary">Solte aqui</p> : null}
        </div>
        <Badge className={theme.badge}>{visibleOrders.length}</Badge>
      </div>

      <SortableContext id={status} items={orders.map((order) => String(order.id))} strategy={rectSortingStrategy}>
        <div className="flex flex-1 flex-col gap-3">
          {visibleOrders.length > 0 ? (
            children
          ) : (
            <div className={`flex flex-1 items-center justify-center rounded-xl border border-dashed p-4 text-xs sm:p-6 sm:text-sm ${theme.empty}`}>
              Nenhuma OP nesta etapa.
            </div>
          )}
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
  const { canWrite } = useAuthz();
  const isMobile = useIsMobile();

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
  const [customizationNotes, setCustomizationNotes] = useState("");
  const [dueAt, setDueAt] = useState<Date | undefined>(undefined);
  const [activeDropTarget, setActiveDropTarget] = useState<ProductionKanbanStatus | null>(null);
  const [activeOverId, setActiveOverId] = useState<string | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStartRectRef = useRef<{ left: number; width: number } | null>(null);
  useEffect(() => {
    setBoardState(createBoardState(orders));
  }, [orders]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  const selectedProduct = useMemo(() => activeProducts.find((product) => String(product.id) === productId), [activeProducts, productId]);
  const activeOrder = activeOrderId !== null ? findOrder(boardState, activeOrderId) : null;
  const interactionsDisabled = moveMutation.isPending || concludeMutation.isPending || pendingCompletion !== null || pendingStart !== null;

  const productById = useMemo(() => new Map((products ?? []).map((product) => [product.id, product])), [products]);
  const materialById = useMemo(() => new Map((materials ?? []).map((material) => [material.id, material])), [materials]);
  const selectedProductBomCount = selectedProduct?.bomItems?.length ?? 0;

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite) {
      toast({ title: "Sem permissão", description: "Seu usuário não pode criar ordens de produção.", variant: "destructive" });
      return;
    }
    if (selectedProductBomCount === 0) {
      toast({
        title: "Produto sem ficha técnica",
        description: "Não é possível criar OP sem uma ficha técnica ativa para este produto.",
        variant: "destructive",
      });
      return;
    }
    const dueAtIso = dueAt
      ? new Date(dueAt.getFullYear(), dueAt.getMonth(), dueAt.getDate(), 12, 0, 0, 0).toISOString()
      : null;
    createMutation.mutate(
      {
        productId: Number(productId),
        qtyPlanned: Number(qtyPlanned),
        customizationNotes: customizationNotes.trim() || null,
        salesChannel: "ONLINE",
        dueAt: dueAtIso,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setProductId("");
          setQtyPlanned("1");
          setCustomizationNotes("");
          setDueAt(undefined);
        },
      },
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    const nextOrderId = Number(event.active.id);
    if (!Number.isNaN(nextOrderId)) {
      setActiveOrderId(nextOrderId);
      const activeRect = event.active.rect.current as { initial?: { left: number; width: number } } | null;
      dragStartRectRef.current = activeRect?.initial
        ? {
            left: activeRect.initial.left,
            width: activeRect.initial.width,
          }
        : null;
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const board = boardScrollRef.current;
    if (!board || !dragStartRectRef.current) return;

    const { left, width } = dragStartRectRef.current;
    const cardCenter = left + event.delta.x + width / 2;
    const boardRect = board.getBoundingClientRect();
    const edgeThreshold = isMobile ? 180 : 100;
    const scrollStep = isMobile ? 60 : 24;

    if (cardCenter > boardRect.right - edgeThreshold) {
      board.scrollLeft += scrollStep;
    } else if (cardCenter < boardRect.left + edgeThreshold) {
      board.scrollLeft -= scrollStep;
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    setActiveOverId(event.over ? String(event.over.id) : null);
    const targetStatus = event.over ? resolveDropTargetStatus(boardState, String(event.over.id)) : null;
    setActiveDropTarget(targetStatus ?? null);
  };

  const moveOrderWithConfirmation = (orderId: number, destinationStatus: ActiveProductionKanbanStatus | "DONE") => {
    const sourceStatus = findStatusByOrderId(boardState, orderId);
    if (!sourceStatus || sourceStatus === "DONE") return;

    const order = findOrder(boardState, orderId);
    if (!order) return;

    const productBomCount = productById.get(order.productId)?.bomItems?.length ?? 0;
    if (destinationStatus === "IN_PROGRESS" && productBomCount === 0) {
      toast({
        title: "Produto sem ficha técnica",
        description: "Este produto ainda não possui ficha técnica ativa. Adicione a ficha antes de iniciar a produção.",
        variant: "destructive",
      });
      return;
    }

    const result = moveOrderOnBoard(boardState, orderId, destinationStatus);
    if (!result) return;

    const previousBoard = boardState;
    const { nextBoard } = result;

    setBoardState(nextBoard);

    if (destinationStatus === "DONE") {
      setPendingCompletion({ orderId, previousBoard, nextBoard });
      return;
    }

    if (sourceStatus === "BACKLOG" && destinationStatus === "IN_PROGRESS") {
      setPendingStart({
        orderId,
        previousBoard,
        nextBoard,
        orderedIds: nextBoard[destinationStatus].map((order) => order.id),
      });
      return;
    }

    moveMutation.mutate(
      {
        id: orderId,
        data: {
          status: destinationStatus,
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

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveOrderId(null);
    setActiveDropTarget(null);
    setActiveOverId(null);
    dragStartRectRef.current = null;
    const { active, over } = event;
    if (!over) return;

    const activeId = Number(active.id);
    if (Number.isNaN(activeId)) return;

    const sourceStatus = findStatusByOrderId(boardState, activeId);
    if (!sourceStatus || sourceStatus === "DONE") return;
    const destinationStatus = resolveDropTargetStatus(boardState, String(over.id));
    if (!destinationStatus) return;

    if (sourceStatus === "IN_PROGRESS" && destinationStatus === "BACKLOG") {
      toast({
        title: "Movimento não permitido",
        description: "Ordens que já iniciaram produção não podem voltar para o backlog porque os materiais já foram baixados.",
        variant: "destructive",
      });
      return;
    }
    moveOrderWithConfirmation(activeId, destinationStatus === "DONE" ? "DONE" : destinationStatus);
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

  const renderInsertionMarker = (key: string) => (
    <div
      key={key}
      className="rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-3 py-4 text-center text-xs font-medium text-primary"
    >
      Solte aqui para inserir
    </div>
  );

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <Factory className="h-8 w-8 text-primary" />
          Ordens de Produção
        </h1>

        <ResponsiveDialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <ResponsiveDialogTrigger asChild>
            <Button disabled={!canWrite || createMutation.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Nova OP
            </Button>
          </ResponsiveDialogTrigger>
          <ResponsiveDialogContent className="max-w-2xl border-border bg-card text-card-foreground shadow-2xl">
            <ResponsiveDialogHeader className="border-b border-border px-4 pb-4 pt-5 md:px-6">
              <ResponsiveDialogTitle className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">Criar Ordem de Produção</ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="text-sm text-foreground/75">A nova OP entra no backlog. Os materiais serão baixados quando ela entrar em produção.</ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <form onSubmit={handleCreate} className="flex min-h-[320px] flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6">
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger className="h-11 rounded-xl border-border bg-card px-4"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {activeProducts.map((product) => (
                        <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade planejada</Label>
                  <Input type="number" min="1" value={qtyPlanned} onChange={(e) => setQtyPlanned(e.target.value)} className="h-11 rounded-xl border-border bg-card px-4" />
                </div>

                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    value={customizationNotes}
                    onChange={(e) => setCustomizationNotes(e.target.value)}
                    placeholder="Ex.: carteira Cirrus para RG, medida 105 cm, mescla de cores..."
                    rows={3}
                    maxLength={500}
                    className="rounded-xl border-border bg-card px-4 py-3"
                  />
                </div>

              <div className="space-y-2">
                <Label>Prazo (opcional)</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={`h-11 justify-start rounded-xl border-border bg-card px-4 text-left font-normal hover:bg-card ${!dueAt ? "text-muted-foreground" : ""}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueAt ? format(dueAt, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dueAt} onSelect={setDueAt} initialFocus />
                    </PopoverContent>
                  </Popover>
                  {dueAt ? (
                    <Button type="button" variant="ghost" onClick={() => setDueAt(undefined)}>
                      Limpar
                    </Button>
                  ) : null}
                </div>
              </div>

              {selectedProduct ? (
                <div className="space-y-1 rounded-xl border border-border p-3 text-sm">
                  <div><strong>Entrada inicial:</strong> Backlog</div>
                  <div><strong>Baixa de materiais:</strong> ao mover para Em produção</div>
                  <div><strong>Materiais na ficha:</strong> {selectedProductBomCount}</div>
                  {selectedProductBomCount === 0 ? (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700">
                      Este produto não pode gerar OP até ter uma ficha técnica ativa.
                    </div>
                  ) : null}
                  <div><strong>Quantidade planejada:</strong> {qtyPlanned}</div>
                  <div><strong>Descrição:</strong> {customizationNotes.trim() || "-"}</div>
                  <div><strong>Prazo:</strong> {dueAt ? format(dueAt, "dd/MM/yyyy", { locale: ptBR }) : "-"}</div>
                </div>
              ) : null}
              </div>
              <ResponsiveDialogFooter className="justify-end gap-2 border-t border-border px-4 py-4 md:px-6">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || !productId || selectedProductBomCount === 0}>
                  {createMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...</>
                  ) : "Criar"}
                </Button>
              </ResponsiveDialogFooter>
            </form>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
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
        <div className="-mx-2 flex gap-4 overflow-x-auto px-2 pb-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="min-w-[240px] flex-none rounded-2xl sm:min-w-[320px]">
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
      ) : orders ? (
        <>
          {orders.length === 0 ? (
            <Card className="mb-4">
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
          ) : null}

          {isMobile ? (
            <div className="mb-3 rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Segure o ícone do card por um instante para arrastar. Arraste para a coluna desejada e solte.
            </div>
          ) : null}

          <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <div ref={boardScrollRef} className="-mx-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-2 pb-2 touch-pan-x sm:gap-4">
              {columnOrder.map((status) => {
                const columnOrders = boardState[status] ?? [];
                const activeOverIsColumn = activeOverId === status;
                const activeOverOrderId = activeOverId && activeOverId !== status ? Number(activeOverId) : Number.NaN;
                return (
                  <ColumnDropZone key={status} status={status} orders={columnOrders} isActiveTarget={activeDropTarget === status}>
                    {status === "DONE"
                      ? null
                      : columnOrders.flatMap((order, index) => {
                          const items: ReactNode[] = [];
                          const shouldInsertBefore = !Number.isNaN(activeOverOrderId) && order.id === activeOverOrderId;
                          if (shouldInsertBefore) {
                            items.push(renderInsertionMarker(`${status}-before-${order.id}`));
                          }
                          const bomWarning = (productById.get(order.productId)?.bomItems?.length ?? 0) === 0;
                          items.push(
                            <ProductionCard
                              key={order.id}
                              order={order}
                              bomWarning={bomWarning}
                              dragDisabled={interactionsDisabled || order.status === "DONE"}
                            />,
                          );
                          if (index === columnOrders.length - 1 && activeOverIsColumn) {
                            items.push(renderInsertionMarker(`${status}-end`));
                          }
                          return items;
                        })}
                  </ColumnDropZone>
                );
              })}
            </div>

            <DragOverlay>
              {activeOrder ? (
                <article className={`rounded-xl border p-3 shadow-xl ring-2 ring-primary/30 sm:p-4 ${columnTheme[activeOrder.status].card} opacity-95`}>
                  <ProductionCardBody order={activeOrder} />
                </article>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      ) : null}

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
              {moveMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando...</>
              ) : "Iniciar produção"}
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
            <AlertDialogAction onClick={handleCompletionConfirm} disabled={concludeMutation.isPending}>
              {concludeMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Concluindo...</>
              ) : "Concluir OP"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
