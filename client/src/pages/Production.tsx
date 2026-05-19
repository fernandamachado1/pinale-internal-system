import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { closestCorners, DndContext, DragOverlay, MouseSensor, pointerWithin, TouchSensor, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragMoveEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ProductionOrderWithProduct } from "@shared/schema";
import { Layout } from "@/components/Layout";
import {
  useDeleteProductionOrder,
  useConcludeProductionOrder,
  useCreateProductionOrder,
  useDeliverProductionOrder,
  useMaterials,
  useMoveProductionOrder,
  useProducts,
  useProductionOrders,
  useUpdateProductionOrder,
  useUpdateProductionOrderFinancials,
} from "@/hooks/use-erp";
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
import { CalendarIcon, ChevronLeft, ChevronRight, Factory, GripVertical, Info, Loader2, Package, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatQty } from "@/lib/format";
import { useAuthz } from "@/hooks/use-authz";
import { useIsMobile } from "@/hooks/use-mobile";

type ProductionKanbanStatus = ProductionOrderWithProduct["status"];
type ProductionOrderType = ProductionOrderWithProduct["orderType"];
type ActiveProductionKanbanStatus = Exclude<ProductionKanbanStatus, "DONE">;
type ProductionBoardState = Record<ProductionKanbanStatus, ProductionOrderWithProduct[]>;
type ProductionOrderPaymentStatus = "PENDING" | "PARTIAL" | "PAID";
type ProductionOrderDeliveryStatus = "PENDING" | "DELIVERED";

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

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function parseCurrencyInput(value: string) {
  const normalizedValue = value.replace(/[^\d,.-]/g, "").trim();
  if (!normalizedValue) return NaN;

  if (normalizedValue.includes(",") && normalizedValue.includes(".")) {
    return Number(normalizedValue.replace(/\./g, "").replace(",", "."));
  }

  if (normalizedValue.includes(",")) {
    return Number(normalizedValue.replace(",", "."));
  }

  return Number(normalizedValue);
}

function formatCurrencyInputValue(value: string | number) {
  const numericValue = typeof value === "number" ? value : parseCurrencyInput(value);
  if (!Number.isFinite(numericValue)) return "";
  return formatCurrency(numericValue);
}

function formatCurrencyFromInput(value: string) {
  const numericValue = parseCurrencyInput(value);
  return Number.isFinite(numericValue) ? formatCurrency(numericValue) : "-";
}

function normalizeCurrencyInput(value: string) {
  const numericValue = parseCurrencyInput(value);
  return Number.isFinite(numericValue) ? formatCurrency(numericValue) : "";
}

function getPaymentStatus(order: ProductionOrderWithProduct): ProductionOrderPaymentStatus | null {
  if (order.orderType !== "ENCOMENDA") return null;
  const totalDue = Number(order.product.price ?? 0) * Number(order.qtyPlanned ?? 0);
  const amountPaid = Number(order.amountPaid ?? 0);
  if (totalDue <= 0) return "PENDING";
  if (amountPaid <= 0) return "PENDING";
  if (amountPaid + 1e-9 >= totalDue) return "PAID";
  return "PARTIAL";
}

function getDeliveryStatus(order: ProductionOrderWithProduct): ProductionOrderDeliveryStatus {
  return order.deliveredAt ? "DELIVERED" : "PENDING";
}

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

function normalizeDestinationOrderedIds(
  currentOrders: ProductionOrderWithProduct[] | undefined,
  destinationStatus: ActiveProductionKanbanStatus,
  movingOrderId: number,
  desiredOrderedIds: number[],
): number[] {
  if (!currentOrders) return desiredOrderedIds;

  const destinationIds = currentOrders
    .filter((entry) => entry.status === destinationStatus && entry.id !== movingOrderId)
    .map((entry) => entry.id);

  const expectedIds = new Set<number>([...destinationIds, movingOrderId]);

  const normalized = desiredOrderedIds.filter((id) => expectedIds.has(id));
  for (const id of expectedIds) {
    if (!normalized.includes(id)) normalized.push(id);
  }
  return normalized;
}

function computeStartStockShortages(
  input: {
    productBomItems: Array<{ materialId: number; qtyPerUnit: unknown }>;
    qtyPlanned: number;
    materialById: Map<number, { name: string; stockQty: unknown; reservedQty?: unknown | null; stockTracked?: boolean | null }>;
  },
): Array<{ name: string; needed: number; available: number }> {
  const shortages: Array<{ name: string; needed: number; available: number }> = [];
  for (const bomItem of input.productBomItems) {
    const material = input.materialById.get(bomItem.materialId);
    if (!material) continue;
    if (material.stockTracked === false) continue;
    const perUnit = Number(bomItem.qtyPerUnit);
    if (!Number.isFinite(perUnit) || perUnit <= 0) continue;
    const needed = perUnit * input.qtyPlanned;
    const stockQty = Number(material.stockQty);
    const reservedQty = Number(material.reservedQty ?? 0);
    const available = (Number.isFinite(stockQty) ? stockQty : 0) - (Number.isFinite(reservedQty) ? reservedQty : 0);
    if (needed - available > 1e-9) {
      shortages.push({ name: material.name, needed, available: Math.max(0, available) });
    }
  }
  return shortages;
}

function ProductionCardBody({
  order,
  moveControls,
  orderActions,
  statusHint,
  showDragHint,
}: {
  order: ProductionOrderWithProduct;
  moveControls?: ReactNode;
  orderActions?: ReactNode;
  statusHint?: ReactNode;
  showDragHint?: boolean;
}) {
  const dueDate = order.dueAt ? new Date(order.dueAt as any) : null;
  const daysToDue = dueDate ? differenceInCalendarDays(startOfDay(dueDate), startOfDay(new Date())) : null;
  const isOverdue = order.status !== "DONE" && daysToDue !== null && daysToDue < 0;
  const isDueSoon = order.status !== "DONE" && daysToDue !== null && daysToDue >= 0 && daysToDue <= 3;
  const notes = order.customizationNotes?.trim();
  const description = notes ?? "";
  const paymentStatus = getPaymentStatus(order);
  const isEncomenda = order.orderType === "ENCOMENDA";
  const showPaymentBadge = paymentStatus !== null && (!isEncomenda || paymentStatus !== "PENDING");
  const statusLabel = columnMeta[order.status].title;

  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold sm:text-sm">OP #{order.id}</div>
            <Badge variant="outline" className="border-border/60 bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground sm:text-xs">
              {statusLabel}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground sm:text-sm">{order.product.name}</div>
          {showDragHint ? (
            <div className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
              <GripVertical className="h-3.5 w-3.5" />
              Arraste para mover
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1.5 sm:gap-2">
          <div className="flex flex-nowrap items-center justify-end gap-1.5 sm:gap-2">
          {isEncomenda ? (
            <Badge className="border-transparent bg-purple-600 px-2 py-0.5 text-[10px] text-white sm:px-2.5 sm:py-1 sm:text-xs">
              Encomenda
            </Badge>
          ) : null}
          {isDueSoon ? <Badge className="border-transparent bg-yellow-400 px-2 py-0.5 text-[10px] text-yellow-950 sm:px-2.5 sm:py-1 sm:text-xs">A vencer</Badge> : null}
          {showPaymentBadge ? (
            <Badge
              className={`px-2 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-xs ${
                paymentStatus === "PAID"
                  ? "border-transparent bg-emerald-600 text-white"
                  : paymentStatus === "PARTIAL"
                    ? "border-transparent bg-amber-400 text-amber-950"
                    : "border-transparent bg-zinc-500 text-white"
              }`}
            >
              {paymentStatus === "PAID" ? "Pago" : paymentStatus === "PARTIAL" ? "Parcial" : "Pendente"}
            </Badge>
          ) : null}
          {isOverdue ? <Badge className="border-transparent bg-red-600 px-2 py-0.5 text-[10px] text-white sm:px-2.5 sm:py-1 sm:text-xs">Vencida</Badge> : null}
          </div>
          {moveControls}
        </div>
      </div>

      <div className="space-y-2 text-xs sm:space-y-3 sm:text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Package className="h-4 w-4" />
          <span>{order.qtyPlanned} unidade(s)</span>
        </div>
        {description ? (
          <div className="rounded-xl border border-border/50 bg-muted/25 p-3 text-muted-foreground">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Descrição</div>
            <div
              className="mt-1"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {description}
            </div>
          </div>
        ) : null}
        {isEncomenda ? (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-muted-foreground">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Valor</div>
                <div className="font-medium text-foreground">{formatCurrency(Number(order.product.price ?? 0) * Number(order.qtyPlanned ?? 0))}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Pago</div>
                <div className="font-medium text-foreground">{formatCurrency(Number(order.amountPaid ?? 0))}</div>
              </div>
            </div>
            {order.deliveredAt ? (
              <div className="mt-2 text-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Entregue em</span>{" "}
                {format(new Date(order.deliveredAt as any), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            ) : null}
          </div>
        ) : null}
        {statusHint ? <div>{statusHint}</div> : null}
        {orderActions ? <div className="pt-1">{orderActions}</div> : null}
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

function ProductionCard({
  order,
  dragDisabled,
  moveControls,
  orderActions,
  onClick,
  statusHint,
}: {
  order: ProductionOrderWithProduct;
  dragDisabled: boolean;
  moveControls?: ReactNode;
  orderActions?: ReactNode;
  onClick?: () => void;
  statusHint?: ReactNode;
}) {
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

  const dragProps = dragDisabled ? {} : { ...attributes, ...listeners };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`min-h-[92px] shrink-0 rounded-xl border p-2.5 shadow-sm transition-[transform,box-shadow,border-color,background-color] sm:min-h-0 sm:p-4 ${theme.card} ${dragDisabled ? "" : "cursor-grab active:cursor-grabbing"} ${onClick ? "cursor-pointer" : ""} ${isDragging ? "scale-[0.99] opacity-90 shadow-xl ring-2 ring-primary/30" : ""}`}
      aria-label={`OP ${order.id}`}
      {...dragProps}
      onClick={onClick}
    >
      <ProductionCardBody
        order={order}
        moveControls={moveControls}
        orderActions={orderActions}
        statusHint={statusHint}
        showDragHint={!dragDisabled}
      />
    </article>
  );
}

function ColumnDropZone({
  status,
  orders,
  children,
  isActiveTarget,
  isMobile,
}: {
  status: ProductionKanbanStatus;
  orders: ProductionOrderWithProduct[];
  children: ReactNode;
  isActiveTarget?: boolean;
  isMobile?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const theme = columnTheme[status];
  const visibleOrders = orders;

  return (
    <section
      ref={setNodeRef}
      className={`flex max-h-[72vh] flex-col overflow-hidden rounded-2xl border p-2.5 shadow-sm transition-all sm:max-h-[calc(100dvh-18rem)] sm:p-4 ${
        isMobile
          ? "min-h-[260px] w-[82vw] max-w-[420px] flex-none snap-start sm:min-h-[360px]"
          : "min-h-[360px] w-[360px] max-w-[420px] min-w-[320px] flex-none"
      } ${theme.shell} ${isOver || isActiveTarget ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-border/90"}`}
    >
      <div className={`mb-4 flex items-start justify-between gap-3 rounded-2xl border px-3 py-3 backdrop-blur-sm ${isOver || isActiveTarget ? "border-primary/20 bg-background/90" : "border-border/50 bg-background/70"}`}>
        <div>
          <div className={`mb-2 h-1.5 w-14 rounded-full ${theme.accent}`} />
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold sm:text-base">{columnMeta[status].title}</h2>
            {isActiveTarget ? <Badge className="border-transparent bg-primary text-[10px] text-primary-foreground">Soltar aqui</Badge> : null}
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">{columnMeta[status].description}</p>
        </div>
        <Badge className={theme.badge}>{visibleOrders.length}</Badge>
      </div>

      <SortableContext id={status} items={orders.map((order) => String(order.id))} strategy={rectSortingStrategy}>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {visibleOrders.length > 0 ? (
            children
          ) : (
            <div className={`flex flex-1 items-center justify-center rounded-xl border border-dashed p-4 text-center text-xs sm:p-6 sm:text-sm ${theme.empty}`}>
              <div className="space-y-1">
                <div className="font-medium text-foreground/80">Nenhuma OP nesta etapa</div>
                <div className="text-muted-foreground">Arraste uma ordem para começar a preenchê-la.</div>
              </div>
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
  const updateOrderMutation = useUpdateProductionOrder();
  const updateFinancialsMutation = useUpdateProductionOrderFinancials();
  const deliverMutation = useDeliverProductionOrder();
  const deleteOrderMutation = useDeleteProductionOrder();
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
  const [editingOrder, setEditingOrder] = useState<ProductionOrderWithProduct | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<ProductionOrderWithProduct | null>(null);
  const [orderType, setOrderType] = useState<ProductionOrderType>("NORMAL");
  const [productId, setProductId] = useState("");
  const [qtyPlanned, setQtyPlanned] = useState("1");
  const [customizationNotes, setCustomizationNotes] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [dueAt, setDueAt] = useState<Date | undefined>(undefined);
  const [paymentDialogOrder, setPaymentDialogOrder] = useState<ProductionOrderWithProduct | null>(null);
  const [paymentDialogAmountPaid, setPaymentDialogAmountPaid] = useState("");
  const [deliveryDialogOrder, setDeliveryDialogOrder] = useState<ProductionOrderWithProduct | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<ProductionKanbanStatus | null>(null);
  const [activeOverId, setActiveOverId] = useState<string | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStartRectRef = useRef<{ left: number; width: number } | null>(null);
  const suppressCardClickRef = useRef(false);
  useEffect(() => {
    if (pendingCompletion !== null) return;
    if (pendingStart !== null) return;
    if (activeOrderId !== null) return;
    setBoardState(createBoardState(orders));
  }, [orders]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  const formProducts = useMemo(() => {
    if (!editingOrder) return activeProducts;
    const currentProduct = products?.find((product) => product.id === editingOrder.productId);
    if (!currentProduct) return activeProducts;
    if (activeProducts.some((product) => product.id === currentProduct.id)) return activeProducts;
    return [...activeProducts, currentProduct];
  }, [activeProducts, editingOrder, products]);
  const selectedProductForForm = useMemo(
    () => formProducts.find((product) => String(product.id) === productId),
    [formProducts, productId],
  );
  const selectedProduct = selectedProductForForm;
  const activeOrder = activeOrderId !== null ? findOrder(boardState, activeOrderId) : null;
  const boardStats = useMemo(
    () => [
      { label: "Total de OPs", value: orders?.length ?? 0, hint: "Cadastros visíveis no quadro" },
      { label: "Backlog", value: boardState.BACKLOG.length, hint: "Aguardando início" },
      { label: "Em produção", value: boardState.IN_PROGRESS.length, hint: "Em execução" },
      { label: "Concluídas", value: boardState.DONE.length, hint: "Enviadas ao estoque" },
    ],
    [boardState, orders],
  );
  const interactionsDisabled =
    moveMutation.isPending ||
    concludeMutation.isPending ||
    updateOrderMutation.isPending ||
    updateFinancialsMutation.isPending ||
    deliverMutation.isPending ||
    deleteOrderMutation.isPending ||
    pendingCompletion !== null ||
    pendingStart !== null;

  const productById = useMemo(() => new Map((products ?? []).map((product) => [product.id, product])), [products]);
  const materialById = useMemo(() => new Map((materials ?? []).map((material) => [material.id, material])), [materials]);
  const selectedProductBomCount = selectedProduct?.bomItems?.length ?? 0;
  const selectedProductIdValue = Number(productId);
  const qtyPlannedValue = Number(qtyPlanned);
  const isCoreOrderChange =
    editingOrder === null ||
    editingOrder.productId !== selectedProductIdValue ||
    editingOrder.qtyPlanned !== qtyPlannedValue ||
    editingOrder.orderType !== orderType;

  const resetCreateForm = () => {
    setOrderType("NORMAL");
    setProductId("");
    setQtyPlanned("1");
    setCustomizationNotes("");
    setAmountPaid("");
    setDueAt(undefined);
  };

  const populateOrderForm = (order: ProductionOrderWithProduct) => {
    setEditingOrder(order);
    setOrderType(order.orderType);
    setProductId(String(order.productId));
    setQtyPlanned(String(order.qtyPlanned));
    setCustomizationNotes(order.customizationNotes ?? "");
    setAmountPaid(formatCurrencyInputValue(Number(order.amountPaid ?? 0)));
    setDueAt(order.dueAt ? new Date(order.dueAt) : undefined);
  };

  const openCreateForm = () => {
    setEditingOrder(null);
    resetCreateForm();
    setIsCreateOpen(true);
  };

  const openEditForm = (order: ProductionOrderWithProduct) => {
    populateOrderForm(order);
    setIsCreateOpen(true);
  };

  const handleOrderSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite) {
      toast({ title: "Sem permissão", description: "Seu usuário não pode criar ou editar ordens de produção.", variant: "destructive" });
      return;
    }
    const qtyValue = Number(qtyPlanned);
    if (!Number.isFinite(qtyValue) || qtyValue <= 0) {
      toast({ title: "Dados inválidos", description: "Informe uma quantidade planejada maior que zero.", variant: "destructive" });
      return;
    }
    if (isCoreOrderChange && selectedProductBomCount === 0) {
      toast({
        title: "Produto sem ficha técnica",
        description: "Não é possível criar OP sem uma ficha técnica ativa para este produto.",
        variant: "destructive",
      });
      return;
    }

    const paidValue = amountPaid.trim() ? parseCurrencyInput(amountPaid) : 0;
    if (orderType === "ENCOMENDA") {
      if (!Number.isFinite(paidValue) || paidValue < 0) {
        toast({ title: "Dados inválidos", description: "Informe um sinal válido.", variant: "destructive" });
        return;
      }
      const productValue = Number(selectedProduct?.price ?? 0) * qtyValue;
      if (paidValue - productValue > 1e-9) {
        toast({ title: "Dados inválidos", description: "O sinal não pode ser maior que o valor do produto.", variant: "destructive" });
        return;
      }
    }

    if (isCoreOrderChange) {
      const shortages = computeStartStockShortages({
        productBomItems: selectedProduct?.bomItems ?? [],
        qtyPlanned: qtyValue,
        materialById,
      });
      if (shortages.length > 0) {
        const head = shortages
          .slice(0, 3)
          .map((s) => `${s.name}: precisa ${formatQty(s.needed)}, disponível ${formatQty(s.available)}`)
          .join(" · ");
        const tail = shortages.length > 3 ? ` · +${shortages.length - 3} material(is)` : "";
        toast({
          title: "Estoque insuficiente",
          description: `${head}${tail}`,
          variant: "destructive",
        });
        return;
      }
    }

    const dueAtIso = dueAt
      ? new Date(dueAt.getFullYear(), dueAt.getMonth(), dueAt.getDate(), 12, 0, 0, 0).toISOString()
      : null;

    const payload = {
      productId: selectedProductIdValue,
      qtyPlanned: qtyValue,
      orderType,
      customizationNotes: customizationNotes.trim() || null,
      amountPaid: orderType === "ENCOMENDA" ? paidValue : 0,
      salesChannel: "ONLINE" as const,
      dueAt: dueAtIso,
    };

    if (editingOrder) {
      updateOrderMutation.mutate(
        {
          id: editingOrder.id,
          data: payload,
        },
        {
          onSuccess: () => {
            setIsCreateOpen(false);
            setEditingOrder(null);
            resetCreateForm();
          },
        },
      );
      return;
    }

    createMutation.mutate(payload, {
      onSuccess: () => {
        setIsCreateOpen(false);
        setEditingOrder(null);
        resetCreateForm();
      },
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const nextOrderId = Number(event.active.id);
    if (!Number.isNaN(nextOrderId)) {
      suppressCardClickRef.current = true;
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
    if (isMobile) return;
    const board = boardScrollRef.current;
    if (!board || !dragStartRectRef.current) return;
    if (board.scrollWidth <= board.clientWidth) return;

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
        orderedIds: normalizeDestinationOrderedIds(
          orders,
          destinationStatus,
          orderId,
          nextBoard[destinationStatus].map((order) => order.id),
        ),
      });
      return;
    }

    moveMutation.mutate(
      {
        id: orderId,
        data: {
          status: destinationStatus,
          orderedIds: normalizeDestinationOrderedIds(
            orders,
            destinationStatus,
            orderId,
            nextBoard[destinationStatus].map((order) => order.id),
          ),
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
    window.setTimeout(() => {
      suppressCardClickRef.current = false;
    }, 0);
    const { active, over } = event;
    if (!over) return;

    const activeId = Number(active.id);
    if (Number.isNaN(activeId)) return;

    const sourceStatus = findStatusByOrderId(boardState, activeId);
    if (!sourceStatus || sourceStatus === "DONE") return;
    const destinationStatus = resolveDropTargetStatus(boardState, String(over.id));
    if (!destinationStatus) return;

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

    const movingOrder = findOrder(pendingStart.nextBoard, orderId);
    if (movingOrder) {
      const product = productById.get(movingOrder.productId);
      const bomItems = product?.bomItems ?? [];
      const shortages = computeStartStockShortages({
        productBomItems: bomItems,
        qtyPlanned: movingOrder.qtyPlanned,
        materialById,
      });

      if (shortages.length > 0) {
        toast({
          title: "Estoque insuficiente",
          description: shortages
            .slice(0, 3)
            .map((s) => `${s.name}: precisa ${formatQty(s.needed)}, disponível ${formatQty(s.available)}`)
            .join(" · "),
          variant: "destructive",
        });
        handleStartCancel();
        return;
      }
    }

    moveMutation.mutate(
      {
        id: orderId,
        data: {
          status: "IN_PROGRESS",
          orderedIds: normalizeDestinationOrderedIds(
            orders,
            "IN_PROGRESS",
            orderId,
            pendingStart.orderedIds,
          ),
        },
      },
      {
        onError: () => setBoardState(pendingStart.previousBoard),
        onSettled: () => setPendingStart(null),
      },
    );
  };

  const openPaymentDialog = (order: ProductionOrderWithProduct) => {
    setPaymentDialogOrder(order);
    setPaymentDialogAmountPaid(formatCurrencyInputValue(Number(order.amountPaid ?? 0)));
  };

  const handlePaymentSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentDialogOrder) return;

    const paidValue = paymentDialogAmountPaid.trim() ? parseCurrencyInput(paymentDialogAmountPaid) : 0;

    if (!Number.isFinite(paidValue) || paidValue < 0) {
      toast({ title: "Dados inválidos", description: "Informe um valor pago válido.", variant: "destructive" });
      return;
    }
    const productValue = Number(paymentDialogOrder.product.price ?? 0) * Number(paymentDialogOrder.qtyPlanned ?? 0);
    if (paidValue - productValue > 1e-9) {
      toast({ title: "Dados inválidos", description: "O valor pago não pode ser maior que o valor do produto.", variant: "destructive" });
      return;
    }

    updateFinancialsMutation.mutate(
      {
        id: paymentDialogOrder.id,
        data: {
          amountPaid: paidValue,
        },
      },
      {
        onSuccess: () => setPaymentDialogOrder(null),
      },
    );
  };

  const openDeliveryDialog = (order: ProductionOrderWithProduct) => {
    setDeliveryDialogOrder(order);
  };

  const handleDeliveryConfirm = () => {
    if (!deliveryDialogOrder) return;
    deliverMutation.mutate(
      { id: deliveryDialogOrder.id, data: {} },
      {
        onSuccess: () => setDeliveryDialogOrder(null),
      },
    );
  };

  const openDeleteDialog = (order: ProductionOrderWithProduct) => {
    setOrderToDelete(order);
  };

  const handleDeleteConfirm = () => {
    if (!orderToDelete) return;
    deleteOrderMutation.mutate(orderToDelete.id, {
      onSuccess: () => {
        setOrderToDelete(null);
        setIsCreateOpen(false);
        setEditingOrder(null);
        resetCreateForm();
      },
    });
  };

  const renderInsertionMarker = (key: string) => (
    <div
      key={key}
      className="shrink-0 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-3 py-4 text-center text-xs font-medium text-primary"
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

        <ResponsiveDialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) {
              setEditingOrder(null);
              resetCreateForm();
            }
          }}
        >
          <ResponsiveDialogTrigger asChild>
            <Button disabled={!canWrite || createMutation.isPending || updateOrderMutation.isPending} onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" /> Nova OP
            </Button>
          </ResponsiveDialogTrigger>
          <ResponsiveDialogContent className="max-w-2xl border-border bg-card text-card-foreground shadow-2xl">
            <ResponsiveDialogHeader className="border-b border-border px-4 pb-4 pt-5 md:px-6">
              <ResponsiveDialogTitle className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">
                {editingOrder ? `Editar Ordem de Produção #${editingOrder.id}` : "Criar Ordem de Produção"}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="text-sm text-foreground/75">
                {editingOrder
                  ? "Ajuste os dados da OP. Enquanto estiver em produção, produto, quantidade e tipo ficam travados."
                  : "A nova OP entra no backlog. Os materiais serão reservados ao mover para Em produção e consumidos ao concluir."}
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <form onSubmit={handleOrderSubmit} className="flex min-h-[320px] flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={orderType}
                    onValueChange={(value) => setOrderType(value as ProductionOrderType)}
                    disabled={editingOrder?.status === "IN_PROGRESS"}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-border bg-card px-4">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="ENCOMENDA">Encomenda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select
                    value={productId}
                    onValueChange={setProductId}
                    disabled={editingOrder?.status === "IN_PROGRESS"}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-border bg-card px-4"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {formProducts.map((product) => (
                        <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade planejada</Label>
                  <Input
                    type="number"
                    min="1"
                    value={qtyPlanned}
                    onChange={(e) => setQtyPlanned(e.target.value)}
                    disabled={editingOrder?.status === "IN_PROGRESS"}
                    className="h-11 rounded-xl border-border bg-card px-4"
                  />
                </div>

                {orderType === "ENCOMENDA" ? (
                  <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Dados da encomenda</div>
                        <div className="text-xs text-muted-foreground">O valor vem do preço do produto; o sinal continua opcional.</div>
                      </div>
                      <Badge className="border-transparent bg-purple-600 text-white">Encomenda</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Label>Sinal recebido</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(normalizeCurrencyInput(e.target.value))}
                        placeholder="Opcional"
                        className="h-11 rounded-xl border-border bg-card px-4"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    value={customizationNotes}
                    onChange={(e) => setCustomizationNotes(e.target.value)}
                    placeholder="Ex.: carteira Cirrus para RG, mescla de cores..."
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
                    <div><strong>Reserva de materiais:</strong> ao mover para Em produção, exceto itens sem controle</div>
                    <div><strong>Materiais na ficha:</strong> {selectedProductBomCount}</div>
                    {selectedProductBomCount === 0 ? (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700">
                        Este produto não pode gerar OP até ter uma ficha técnica ativa.
                      </div>
                    ) : null}
                    <div><strong>Tipo:</strong> {orderType === "ENCOMENDA" ? "Encomenda" : "Normal"}</div>
                    <div><strong>Quantidade planejada:</strong> {qtyPlanned}</div>
                    {orderType === "ENCOMENDA" ? (
                      <>
                        <div><strong>Valor do produto:</strong> {selectedProduct ? formatCurrency(Number(selectedProduct.price ?? 0) * Number(qtyPlanned || 0)) : "-"}</div>
                        <div><strong>Sinal:</strong> {amountPaid.trim() ? formatCurrencyFromInput(amountPaid) : "-"}</div>
                      </>
                    ) : null}
                    <div><strong>Descrição:</strong> {customizationNotes.trim() || "-"}</div>
                    <div><strong>Prazo:</strong> {dueAt ? format(dueAt, "dd/MM/yyyy", { locale: ptBR }) : "-"}</div>
                  </div>
                ) : null}
              </div>
              <ResponsiveDialogFooter className="justify-between gap-2 border-t border-border px-4 py-4 md:px-6">
                <div className="flex items-center gap-2">
                  {editingOrder ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => openDeleteDialog(editingOrder)}
                      disabled={editingOrder.status !== "BACKLOG" || Number(editingOrder.amountPaid ?? 0) > 0 || deleteOrderMutation.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </Button>
                  ) : null}
                  {editingOrder && (editingOrder.status !== "BACKLOG" || Number(editingOrder.amountPaid ?? 0) > 0) ? (
                    <span className="text-xs text-muted-foreground">
                      Só é possível excluir ordens em backlog sem sinal.
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setEditingOrder(null);
                      resetCreateForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createMutation.isPending ||
                      updateOrderMutation.isPending ||
                      !productId ||
                      (isCoreOrderChange && selectedProductBomCount === 0)
                    }
                  >
                    {createMutation.isPending || updateOrderMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {editingOrder ? "Salvando..." : "Criando..."}</>
                    ) : editingOrder ? "Salvar" : "Criar"}
                  </Button>
                </div>
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
            <Card key={index} className="min-w-[240px] flex-none rounded-2xl border-border/70 bg-card/90 shadow-sm sm:min-w-[320px]">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <CardTitle><Skeleton className="h-4 w-24" /></CardTitle>
                    <UiCardDescription><Skeleton className="h-3 w-48" /></UiCardDescription>
                  </div>
                  <Skeleton className="h-6 w-10 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 3 }).map((__, rowIndex) => (
                  <Skeleton key={rowIndex} className="h-24 w-full rounded-xl" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : orders ? (
        <>
          <Card className="mb-4 border-border/70 bg-card/90 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Info className="h-4 w-4 text-primary" />
                  Dicas rápidas
                </div>
                <p className="text-sm text-muted-foreground">
                  Clique em uma OP para editar, arraste para mover entre etapas e use as setas do card quando quiser uma mudança rápida.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-border/60 bg-background/80 text-xs">Clique para editar</Badge>
                <Badge variant="outline" className="border-border/60 bg-background/80 text-xs">Arraste para mover</Badge>
                <Badge variant="outline" className="border-border/60 bg-background/80 text-xs">Setas para avanço rápido</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {boardStats.map((stat) => (
              <Card key={stat.label} className="border-border/70 bg-card/90 shadow-sm">
                <CardContent className="p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</div>
                  <div className="mt-2 text-3xl font-bold tracking-tight">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{stat.hint}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {orders.length === 0 ? (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Nenhuma OP criada</CardTitle>
                <UiCardDescription>Crie uma ordem para acompanhar backlog, produção e conclusão.</UiCardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={openCreateForm}>
                  <Plus className="mr-2 h-4 w-4" /> Nova OP
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isMobile ? (
            <div className="mb-3 rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Arraste para reordenar. Role horizontalmente para navegar entre colunas. Use as setas do card para mover entre etapas.
            </div>
          ) : null}

          <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <div
              ref={boardScrollRef}
              className={isMobile ? "-mx-2 flex snap-x snap-proximity gap-2 overflow-x-auto px-2 pb-2 touch-auto" : "-mx-2 flex gap-4 overflow-x-auto px-2 pb-2"}
            >
              {columnOrder.map((status) => {
                const columnOrders = boardState[status] ?? [];
                const activeOverIsColumn = activeOverId === status;
                const activeOverOrderId = activeOverId && activeOverId !== status ? Number(activeOverId) : Number.NaN;
                return (
                  <ColumnDropZone key={status} status={status} orders={columnOrders} isActiveTarget={activeDropTarget === status} isMobile={isMobile}>
                    {columnOrders.flatMap((order, index) => {
                          const items: ReactNode[] = [];
                          const shouldInsertBefore = !Number.isNaN(activeOverOrderId) && order.id === activeOverOrderId;
                          if (shouldInsertBefore) {
                            items.push(renderInsertionMarker(`${status}-before-${order.id}`));
                          }
                          const bomWarning = (productById.get(order.productId)?.bomItems?.length ?? 0) === 0;

                          const hintBlocks: ReactNode[] = [];
                          if (bomWarning) {
                            hintBlocks.push(
                              <span key="bom-warning" className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                Sem ficha técnica
                              </span>,
                            );
                          }
                          const statusHint = hintBlocks.length ? <div className="space-y-2">{hintBlocks}</div> : undefined;

                          const previousStatus = order.status === "IN_PROGRESS" ? "BACKLOG" : null;
                          const nextStatus = order.status === "BACKLOG" ? "IN_PROGRESS" : order.status === "IN_PROGRESS" ? "DONE" : null;
                          const arrowControls =
                            canWrite && order.status !== "DONE" ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-black/5 text-muted-foreground hover:bg-black/10 active:bg-black/15 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-8"
                                  aria-label="Mover para etapa anterior"
                                  disabled={!previousStatus || interactionsDisabled}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (!previousStatus) return;
                                    moveOrderWithConfirmation(order.id, previousStatus);
                                  }}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-black/5 text-muted-foreground hover:bg-black/10 active:bg-black/15 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-8"
                                  aria-label="Mover para próxima etapa"
                                  disabled={!nextStatus || interactionsDisabled}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (!nextStatus) return;
                                    moveOrderWithConfirmation(order.id, nextStatus as any);
                                  }}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </button>
                              </div>
                            ) : null;
                          const orderActions =
                            canWrite && order.orderType === "ENCOMENDA" ? (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 rounded-lg border-border bg-card px-3 text-xs"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openPaymentDialog(order);
                                  }}
                                  disabled={interactionsDisabled}
                                >
                                  Registrar pagamento
                                </Button>
                                {order.status === "DONE" && !order.deliveredAt ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 rounded-lg px-3 text-xs"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openDeliveryDialog(order);
                                    }}
                                    disabled={interactionsDisabled}
                                  >
                                    Marcar entregue
                                  </Button>
                                ) : null}
                              </div>
                            ) : null;

                          items.push(
                            <ProductionCard
                              key={order.id}
                              order={order}
                              dragDisabled={interactionsDisabled || order.status === "DONE" || isMobile}
                              moveControls={arrowControls}
                              orderActions={orderActions}
                              onClick={() => {
                                if (suppressCardClickRef.current) return;
                                openEditForm(order);
                              }}
                              statusHint={statusHint}
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
                        Ao mover para <strong>Em produção</strong>, os materiais serão reservados do estoque (o consumo acontece ao concluir).
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
                              if (material?.stockTracked === false) {
                                return (
                                  <li key={bomItem.id} className="flex items-center justify-between gap-3">
                                    <span className="min-w-0 truncate">
                                      {material?.name ?? `Material #${bomItem.materialId}`}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">Sem controle</span>
                                  </li>
                                );
                              }
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

      <ResponsiveDialog
        open={paymentDialogOrder !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentDialogOrder(null);
            setPaymentDialogAmountPaid("");
          }
        }}
      >
        <ResponsiveDialogContent className="max-w-xl border-border bg-card text-card-foreground shadow-2xl">
          <ResponsiveDialogHeader className="border-b border-border px-4 pb-4 pt-5 md:px-6">
            <ResponsiveDialogTitle className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">
              Registrar pagamento
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="text-sm text-foreground/75">
              Atualize o sinal da encomenda sem depender da produção.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <form onSubmit={handlePaymentSubmit} className="flex min-h-[220px] flex-col">
            <div className="flex-1 space-y-4 px-4 py-4 md:px-6">
              <div className="space-y-2">
                <Label>Valor pago</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={paymentDialogAmountPaid}
                  onChange={(e) => setPaymentDialogAmountPaid(normalizeCurrencyInput(e.target.value))}
                  className="h-11 rounded-xl border-border bg-card px-4"
                />
              </div>
            </div>
            <ResponsiveDialogFooter className="justify-end gap-2 border-t border-border px-4 py-4 md:px-6">
              <Button type="button" variant="outline" onClick={() => setPaymentDialogOrder(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateFinancialsMutation.isPending}>
                {updateFinancialsMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                ) : "Salvar"}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <AlertDialog
        open={deliveryDialogOrder !== null}
        onOpenChange={(open) => {
          if (!open) setDeliveryDialogOrder(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar encomenda como entregue</AlertDialogTitle>
            <AlertDialogDescription>
              {deliveryDialogOrder ? (
                <>
                  Confirmar entrega da OP <strong>#{deliveryDialogOrder.id}</strong> para{" "}
                  <strong>{deliveryDialogOrder.product.name}</strong>?
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeliveryDialogOrder(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeliveryConfirm} disabled={deliverMutation.isPending}>
              {deliverMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Marcando...</>
              ) : "Marcar entregue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={orderToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setOrderToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir OP #{orderToDelete?.id ?? ""}</AlertDialogTitle>
            <AlertDialogDescription>
              {orderToDelete ? (
                <>
                  Excluir <strong>{orderToDelete.product.name}</strong> da lista? Essa ação só é permitida para ordens em backlog sem sinal registrado.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOrderToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteOrderMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteOrderMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Excluindo...</>
              ) : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
