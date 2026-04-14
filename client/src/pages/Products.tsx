import { useEffect, useMemo, useState } from "react";
import type { CatalogProduct, ProductAttachment } from "@shared/schema";
import { Layout } from "@/components/Layout";
import { useAdjustProducedStock, useCatalogProducts, useCreateProduct, useDeleteProduct, useMaterials, useUpdateProduct } from "@/hooks/use-erp";
import { MaterialDialog } from "@/components/materials/MaterialDialog";
import { MaterialSearchCombobox } from "@/components/materials/MaterialSearchCombobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogFooter, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, FileText, Loader2, MoreVertical, Package, Plus, Trash2, X } from "lucide-react";
import { brl } from "@/lib/format";
import { fromPtBrDecimal, toPtBrDecimal } from "@/lib/ptbr-number";
import { Textarea } from "@/components/ui/textarea";
import { useAuthz } from "@/hooks/use-authz";

type BomFormItem = { materialId?: number; qtyPerUnit: string };

type ParsedDriveAttachment = {
  fileId: string | null;
  imageUrl: string;
  viewUrl: string;
  label: string;
  mimeType: string | null;
};

function getDriveFileId(url: string): string | null {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  try {
    const parsedUrl = new URL(trimmedUrl);
    if (!parsedUrl.hostname.includes("drive.google.com")) return null;

    const pathnameMatch = parsedUrl.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (pathnameMatch) return pathnameMatch[1];

    const searchParamId = parsedUrl.searchParams.get("id");
    if (searchParamId) return searchParamId;

    return null;
  } catch {
    return null;
  }
}

function getAttachmentLabel(url: string, fileId: string | null): string {
  if (fileId) return `Drive ${fileId.slice(0, 8)}`;

  try {
    const parsedUrl = new URL(url);
    const lastPathSegment = parsedUrl.pathname.split("/").filter(Boolean).at(-1);
    return lastPathSegment || parsedUrl.hostname;
  } catch {
    return "Arquivo";
  }
}

function guessMimeType(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".png")) return "image/png";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
    if (pathname.endsWith(".webp")) return "image/webp";
    if (pathname.endsWith(".gif")) return "image/gif";
    if (pathname.endsWith(".pdf")) return "application/pdf";
    return null;
  } catch {
    return null;
  }
}

function parseDriveAttachment(url: string): ParsedDriveAttachment {
  const fileId = getDriveFileId(url);
  return {
    fileId,
    imageUrl: fileId ? `https://drive.google.com/uc?export=view&id=${fileId}` : url,
    viewUrl: fileId ? `https://drive.google.com/file/d/${fileId}/view` : url,
    label: getAttachmentLabel(url, fileId),
    mimeType: guessMimeType(url),
  };
}

function buildAttachment(url: string): ProductAttachment {
  const { fileId, imageUrl, viewUrl, label, mimeType } = parseDriveAttachment(url);
  return {
    url: viewUrl,
    name: label,
    mimeType,
    thumbnailUrl: imageUrl === viewUrl ? null : imageUrl,
    driveFileId: fileId,
  };
}

function coerceAttachment(input: ProductAttachment | string): ProductAttachment {
  if (typeof input === "string") return buildAttachment(input);

  return {
    url: input.url,
    name: input.name || getAttachmentLabel(input.url, input.driveFileId),
    mimeType: input.mimeType ?? guessMimeType(input.url),
    thumbnailUrl: input.thumbnailUrl ?? parseDriveAttachment(input.url).imageUrl,
    driveFileId: input.driveFileId ?? getDriveFileId(input.url),
  };
}

function DriveAttachmentCard({ attachment, onRemove }: { attachment: ProductAttachment; onRemove: () => void }) {
  const [imgError, setImgError] = useState(false);
  const previewUrl = attachment.thumbnailUrl ?? attachment.url;
  const label = attachment.name;

  return (
    <div className="w-24 shrink-0 space-y-1">
      <div className="relative group h-24 rounded-lg overflow-hidden border border-border bg-muted">
        {!imgError ? (
          <img src={previewUrl} alt={label} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <FileText className="w-7 h-7 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground text-center px-1">Arquivo</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
          <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="text-white p-1 rounded hover:bg-white/20" title="Abrir">
            <ExternalLink className="w-4 h-4" />
          </a>
          <button type="button" onClick={onRemove} className="text-white p-1 rounded hover:bg-white/20" title="Remover">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="truncate text-[10px] text-muted-foreground" title={attachment.name}>{label}</p>
    </div>
  );
}

function createEmptyBomItem(): BomFormItem {
  return { materialId: undefined, qtyPerUnit: "1" };
}

function normalizeAttachmentUrl(value: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "";
  try {
    new URL(trimmedValue);
  } catch {
    return "";
  }

  const fileId = getDriveFileId(trimmedValue);
  if (!fileId) return trimmedValue;
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export default function Products() {
  const { toast } = useToast();
  const { data: materials } = useMaterials();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();
  const adjustStockMutation = useAdjustProducedStock();
  const { canWrite } = useAuthz();

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const {
    data: catalogData,
    isLoading: isProductsLoading,
    isFetching: isProductsFetching,
    error: productsError,
    refetch: refetchProducts,
  } = useCatalogProducts(debouncedSearchTerm, page, pageSize);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [materialRowIndex, setMaterialRowIndex] = useState<number | null>(null);
  const [createMaterialForNewRow, setCreateMaterialForNewRow] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [initialStockQty, setInitialStockQty] = useState("0");
  const [hasTechnicalSpec, setHasTechnicalSpec] = useState(false);
  const [bomItems, setBomItems] = useState<BomFormItem[]>([createEmptyBomItem()]);
  const [attachments, setAttachments] = useState<ProductAttachment[]>([]);
  const [attachmentInput, setAttachmentInput] = useState("");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockDialogProduct, setStockDialogProduct] = useState<CatalogProduct | null>(null);
  const [stockDialogMode, setStockDialogMode] = useState<"IN" | "OUT">("IN");
  const [stockDialogQty, setStockDialogQty] = useState("1");
  const [stockDialogNote, setStockDialogNote] = useState("");
  const [stockLoadingProductId, setStockLoadingProductId] = useState<number | null>(null);
  const [stockLoadingMode, setStockLoadingMode] = useState<"IN" | "OUT" | null>(null);
  const [optimisticStockChanges, setOptimisticStockChanges] = useState<Record<number, number>>({});

  const products = catalogData?.items ?? [];
  const totalProducts = catalogData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));

  const activeMaterials = useMemo(() => materials?.filter((material) => material.isActive === 1) ?? [], [materials]);
  const isSavingProduct = createMutation.isPending || updateMutation.isPending;
  const isMutatingStock = adjustStockMutation.isPending;

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchTerm]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!isProductsFetching) setOptimisticStockChanges({});
  }, [catalogData, isProductsFetching]);

  useEffect(() => {
    if (!productDialogOpen) return;

    if (editingProduct) {
      setName(editingProduct.name);
      setPrice(editingProduct.price);
      setDescription(editingProduct.description ?? "");
      setInitialStockQty("0");
      setHasTechnicalSpec(editingProduct.bomItems.length > 0);
      setBomItems(editingProduct.bomItems.length > 0 ? editingProduct.bomItems.map((item) => ({ materialId: item.materialId, qtyPerUnit: String(item.qtyPerUnit) })) : [createEmptyBomItem()]);
      setAttachments((editingProduct.attachments ?? []).map((attachment) => coerceAttachment(attachment as ProductAttachment | string)));
      setAttachmentInput("");
      setAttachmentError(null);
      return;
    }

    setName("");
    setPrice("");
    setDescription("");
    setInitialStockQty("0");
    setHasTechnicalSpec(false);
    setBomItems([createEmptyBomItem()]);
    setAttachments([]);
    setAttachmentInput("");
    setAttachmentError(null);
  }, [productDialogOpen, editingProduct]);

  const setBomItem = (index: number, patch: Partial<BomFormItem>) => {
    setBomItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const addBomItem = () => setBomItems((current) => [...current, createEmptyBomItem()]);
  const removeBomItem = (index: number) => {
    setBomItems((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  };
  const addAttachment = () => {
    const nextAttachment = normalizeAttachmentUrl(attachmentInput);
    if (!nextAttachment) {
      const message = "Informe um link público válido (Google Drive, imagem ou pdf).";
      setAttachmentError(message);
      toast({ title: "Link inválido", description: message, variant: "destructive" });
      return;
    }

    setAttachmentError(null);
    const nextItem = buildAttachment(nextAttachment);
    setAttachments((current) => (current.some((attachment) => attachment.url === nextItem.url) ? current : [...current, nextItem]));
    setAttachmentInput("");
  };

  const removeAttachment = (attachmentToRemove: string) => {
    if (!canWrite) return;
    setAttachments((current) => current.filter((attachment) => attachment.url !== attachmentToRemove));
  };

  const openCreateProductDialog = () => {
    if (!canWrite) return;
    setEditingProduct(null);
    setProductDialogOpen(true);
  };

  const openEditProductDialog = (product: CatalogProduct) => {
    if (!canWrite) return;
    setEditingProduct(product);
    setProductDialogOpen(true);
  };

  const openStockDialog = (product: CatalogProduct, mode: "IN" | "OUT") => {
    if (!canWrite) return;
    setStockDialogProduct(product);
    setStockDialogMode(mode);
    setStockDialogQty("1");
    setStockDialogNote("");
    setStockDialogOpen(true);
  };

  const handleCreateNewMaterialFromSpec = () => {
    if (!canWrite) return;
    setMaterialRowIndex(null);
    setCreateMaterialForNewRow(true);
    setMaterialDialogOpen(true);
  };

  const handleProductSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite) {
      toast({ title: "Sem permissão", description: "Seu usuário não pode criar/editar produtos.", variant: "destructive" });
      return;
    }
    const normalizedInitialStockQty = Number(initialStockQty || 0);
    if (!editingProduct && (!Number.isInteger(normalizedInitialStockQty) || normalizedInitialStockQty < 0)) {
      toast({
        title: "Quantidade inicial inválida",
        description: "Informe um número inteiro maior ou igual a zero.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      product: { name, price, attachments, isActive: 1, description },
      technicalSpec: {
        bomItems: (hasTechnicalSpec ? bomItems : [])
          .filter((item) => item.materialId)
          .map((item) => ({
            materialId: Number(item.materialId),
            qtyPerUnit: item.qtyPerUnit,
        })),
      },
      initialStockQty: editingProduct ? 0 : normalizedInitialStockQty,
    };

    if (editingProduct) {
      updateMutation.mutate(
        { id: editingProduct.id, data: payload },
        {
          onSuccess: () => {
            setProductDialogOpen(false);
            setEditingProduct(null);
          },
        },
      );
      return;
    }

    createMutation.mutate(payload, {
      onSuccess: () => {
        setProductDialogOpen(false);
      },
    });
  };

  const handleStockSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!stockDialogProduct) return;
    const qty = Number(stockDialogQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      toast({
        title: "Quantidade inválida",
        description: "Informe um número inteiro maior que zero.",
        variant: "destructive",
      });
      return;
    }

    const qtyChange = stockDialogMode === "IN" ? qty : -qty;
    setStockLoadingProductId(stockDialogProduct.id);
    setStockLoadingMode(stockDialogMode);
    setOptimisticStockChanges((current) => ({
      ...current,
      [stockDialogProduct.id]: (current[stockDialogProduct.id] ?? 0) + qtyChange,
    }));

    adjustStockMutation.mutate(
      {
        productId: stockDialogProduct.id,
        qtyChange,
        note: stockDialogNote.trim() || null,
      },
      {
        onSuccess: () => setStockDialogOpen(false),
        onError: () => {
          setOptimisticStockChanges((current) => ({
            ...current,
            [stockDialogProduct.id]: (current[stockDialogProduct.id] ?? 0) - qtyChange,
          }));
        },
        onSettled: () => {
          setStockLoadingProductId(null);
          setStockLoadingMode(null);
        },
      },
    );
  };

  const getProductStockSnapshot = (item: CatalogProduct) => {
    const delta = optimisticStockChanges[item.id] ?? 0;
    return {
      inQty: item.inQty + (delta > 0 ? delta : 0),
      outQty: item.outQty + (delta < 0 ? Math.abs(delta) : 0),
      stockQty: item.stockQty + delta,
    };
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Package className="w-8 h-8 text-primary" /> Catálogo de Produtos
        </h1>

        <Button onClick={openCreateProductDialog} disabled={!canWrite || isSavingProduct}>
          <Plus className="w-4 h-4 mr-2" /> Novo item
        </Button>
      </div>

      {productsError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Não foi possível carregar os produtos</AlertTitle>
          <AlertDescription>
            Verifique se o servidor e o banco estão rodando e tente novamente.
            <div className="mt-3">
              <Button variant="outline" onClick={() => refetchProducts()}>
                Tentar novamente
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <Input placeholder="Buscar produto" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Itens por página</span>
          <select
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>

      {isProductsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </div>
      ) : totalProducts === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Comece cadastrando seus produtos</CardTitle>
            <CardDescription>Ficha técnica é opcional no cadastro. Ela só é obrigatória quando for produzir.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openCreateProductDialog} disabled={!canWrite}>
              <Plus className="w-4 h-4 mr-2" /> Novo item
            </Button>
          </CardContent>
        </Card>
      ) : products.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum produto encontrado</CardTitle>
            <CardDescription>Tente ajustar o termo de busca.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="mb-3 text-sm text-muted-foreground flex items-center justify-between">
            <span>{totalProducts} item(ns) no catálogo</span>
            {isProductsFetching ? <span>Atualizando...</span> : null}
          </div>

          <div className="space-y-3 md:hidden">
            {products.map((item) => {
              const stock = getProductStockSnapshot(item);
              return (
                <Card key={item.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <CardDescription>#{item.id} • {brl(Number(item.price))}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-md bg-muted p-2 text-center">
                        <div className="text-muted-foreground text-xs">Entradas</div>
                        <div className="font-semibold">{stock.inQty}</div>
                      </div>
                      <div className="rounded-md bg-muted p-2 text-center">
                        <div className="text-muted-foreground text-xs">Saídas</div>
                        <div className="font-semibold">{stock.outQty}</div>
                      </div>
                      <div className="rounded-md bg-muted p-2 text-center">
                        <div className="text-muted-foreground text-xs">Saldo</div>
                        <div className="font-semibold">{stock.stockQty}</div>
                      </div>
                    </div>
                    <div>
                      {item.bomItems.length > 0 ? (
                        <div className="text-sm text-muted-foreground">{`${item.bomItems.length} material(is)`}</div>
                      ) : (
                        <Badge variant="secondary">Sem ficha técnica</Badge>
                      )}
                    </div>
                    {canWrite ? (
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Ações">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem disabled={isMutatingStock} onSelect={() => openStockDialog(item, "IN")}>Entrada</DropdownMenuItem>
                            <DropdownMenuItem disabled={isMutatingStock} onSelect={() => openStockDialog(item, "OUT")}>Saída</DropdownMenuItem>
                            <DropdownMenuItem disabled={isSavingProduct || isMutatingStock} onSelect={() => openEditProductDialog(item)}>Editar</DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              disabled={deleteMutation.isPending || isMutatingStock || isSavingProduct}
                              onSelect={() => deleteMutation.mutate(item.id)}
                            >
                              Inativar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                  <TableHead className="hidden sm:table-cell">ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Saídas</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="hidden lg:table-cell">Estrutura de produção</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((item) => {
                  const stock = getProductStockSnapshot(item);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="hidden sm:table-cell">#{item.id}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{brl(Number(item.price))}</TableCell>
                      <TableCell className="text-right">{stock.inQty}</TableCell>
                      <TableCell className="text-right">{stock.outQty}</TableCell>
                      <TableCell className="text-right font-semibold">{stock.stockQty}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {item.bomItems.length > 0 ? (
                          <div className="text-sm text-muted-foreground">{`${item.bomItems.length} material(is)`}</div>
                        ) : (
                          <Badge variant="secondary">Sem ficha técnica</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canWrite ? (
                          <div className="hidden sm:flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openStockDialog(item, "IN")} disabled={isMutatingStock}>
                              {isMutatingStock && stockLoadingProductId === item.id && stockLoadingMode === "IN" ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</>
                              ) : "Entrada"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openStockDialog(item, "OUT")} disabled={isMutatingStock}>
                              {isMutatingStock && stockLoadingProductId === item.id && stockLoadingMode === "OUT" ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saindo...</>
                              ) : "Saída"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openEditProductDialog(item)} disabled={isSavingProduct || isMutatingStock}>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={deleteMutation.isPending || isMutatingStock || isSavingProduct}
                              onClick={() => deleteMutation.mutate(item.id)}
                            >
                              {deleteMutation.isPending ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Inativando...</>
                              ) : "Inativar"}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || isProductsFetching} onClick={() => setPage((current) => current - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || isProductsFetching} onClick={() => setPage((current) => current + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      <ResponsiveDialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <ResponsiveDialogContent className="max-w-3xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{editingProduct ? "Editar item do catálogo" : "Criar item do catálogo"}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Cadastre o produto e, se quiser, adicione a ficha técnica agora. Você pode incluir a ficha depois.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <form onSubmit={handleProductSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Preço</Label>
                <Input
                  inputMode="decimal"
                  value={toPtBrDecimal(price)}
                  onChange={(e) => setPrice(fromPtBrDecimal(e.target.value, 2))}
                  placeholder="0,00"
                  required
                />
              </div>
            </div>
            {!editingProduct ? (
              <div className="space-y-2">
                <Label>Quantidade inicial no estoque produzido</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={initialStockQty}
                  onChange={(e) => setInitialStockQty(e.target.value)}
                  placeholder="0"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Informações adicionais sobre o produto" />
            </div>

            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4 md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Label className="text-base">Estrutura de produção (ficha técnica)</Label>
                  <p className="text-sm text-muted-foreground">
                    Opcional no cadastro. Só é obrigatória para abrir/iniciar ordem de produção.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={hasTechnicalSpec ? "outline" : "default"}
                  size="sm"
                  onClick={() => setHasTechnicalSpec((current) => !current)}
                >
                  {hasTechnicalSpec ? "Remover ficha por agora" : "Adicionar ficha agora"}
                </Button>
              </div>

              {hasTechnicalSpec ? (
                <div className="space-y-3">
                  {bomItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                      Nenhum material na ficha técnica ainda.
                    </div>
                  ) : null}
                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={handleCreateNewMaterialFromSpec}>
                      <Plus className="h-4 w-4 mr-1" /> Novo material
                    </Button>
                  </div>

                  {bomItems.map((item, index) => (
                    <div key={index} className="space-y-4 rounded-xl border bg-background p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold">Material {index + 1}</h3>
                          <p className="text-xs text-muted-foreground">Defina o item e o consumo por unidade produzida.</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label="Remover material"
                          onClick={() => removeBomItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),180px]">
                        <div className="space-y-2">
                          <Label>Nome do material</Label>
                          <MaterialSearchCombobox
                            materials={activeMaterials}
                            value={item.materialId}
                            onSelect={(material) => {
                              setBomItem(index, { materialId: material.id });
                            }}
                            placeholder="Pesquisar material cadastrado"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Qtd por unidade</Label>
                          <Input
                            inputMode="decimal"
                            value={toPtBrDecimal(item.qtyPerUnit)}
                            onChange={(e) => setBomItem(index, { qtyPerUnit: fromPtBrDecimal(e.target.value, 3) })}
                            placeholder="0,000"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addBomItem}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar material
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                  Sem ficha técnica por enquanto. Você poderá adicionar depois editando este mesmo produto.
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4 md:p-5">
              <div className="space-y-1">
                <Label className="text-base">Anexos</Label>
                <p className="text-sm text-muted-foreground">
                  Cole links públicos do Google Drive para imagens ou arquivos relacionados ao produto.
                </p>
              </div>

              <div className="flex flex-col gap-2 md:flex-row">
                <Input
                  value={attachmentInput}
                  onChange={(e) => {
                    setAttachmentInput(e.target.value);
                    if (attachmentError) setAttachmentError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAttachment();
                    }
                  }}
                  placeholder="https://drive.google.com/file/d/..."
                />
                <Button type="button" variant="outline" onClick={addAttachment} disabled={!canWrite}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar link
                </Button>
              </div>

              {attachmentError ? <p className="text-sm text-destructive">{attachmentError}</p> : null}

              {attachments.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {attachments.map((attachment) => (
                    <DriveAttachmentCard key={attachment.url} attachment={attachment} onRemove={() => removeAttachment(attachment.url)} />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  Nenhum anexo adicionado.
                </div>
              )}
            </div>

            <ResponsiveDialogFooter className="justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setProductDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={!canWrite || isSavingProduct}>
                {isSavingProduct ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                ) : "Salvar"}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{stockDialogMode === "IN" ? "Registrar entrada" : "Registrar saída"}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {stockDialogProduct ? `Produto: ${stockDialogProduct.name}` : "Selecione um produto."}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <form onSubmit={handleStockSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={stockDialogQty}
                onChange={(e) => setStockDialogQty(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea
                value={stockDialogNote}
                onChange={(e) => setStockDialogNote(e.target.value)}
                placeholder={stockDialogMode === "IN" ? "Ex.: entrada manual de estoque." : "Ex.: perda, troca ou saída manual."}
                maxLength={280}
              />
            </div>
            <ResponsiveDialogFooter className="justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStockDialogOpen(false)} disabled={adjustStockMutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={adjustStockMutation.isPending || !stockDialogProduct || Number(stockDialogQty) <= 0}>
                {adjustStockMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
                ) : "Confirmar"}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <MaterialDialog
        open={materialDialogOpen}
        onOpenChange={(open) => {
          setMaterialDialogOpen(open);
          if (!open) {
            setMaterialRowIndex(null);
            setCreateMaterialForNewRow(false);
          }
        }}
        onCreated={(createdMaterials) => {
          if (createdMaterials.length === 0) return;

          if (materialRowIndex !== null) {
            setBomItem(materialRowIndex, { materialId: createdMaterials[0].id });
            setMaterialRowIndex(null);
            return;
          }

          if (createMaterialForNewRow) {
            setBomItems((current) => [...current, { materialId: createdMaterials[0].id, qtyPerUnit: "1" }]);
            setCreateMaterialForNewRow(false);
          }
        }}
        title="Criar material para a ficha"
        description="Crie o material sem sair do cadastro do produto. O primeiro material criado será salvo em materiais e selecionado na ficha."
      />
    </Layout>
  );
}
