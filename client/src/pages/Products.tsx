import { useEffect, useMemo, useState } from "react";
import type { CatalogProduct, ProductAttachment, ProductCategory, ProductColorVariant } from "@shared/schema";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useCatalogProducts, useCreateProduct, useDeleteProduct, useMaterials, useUpdateProduct } from "@/hooks/use-erp";
import { MaterialDialog } from "@/components/materials/MaterialDialog";
import { MaterialSearchCombobox } from "@/components/materials/MaterialSearchCombobox";
import { AdjustProducedStockDialog } from "@/components/produced-stock/AdjustProducedStockDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogFooter, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpDown, ExternalLink, FileText, Loader2, Package, PencilLine, Plus, Trash2, X } from "lucide-react";
import { brl, formatQtyByUom } from "@/lib/format";
import { fromPtBrDecimal, toPtBrDecimal } from "@/lib/ptbr-number";
import { Textarea } from "@/components/ui/textarea";
import { useAuthz } from "@/hooks/use-authz";

type BomFormItem = { materialId?: number; qtyPerUnit: string };
type ColorFormItem = { name: string; qty: string };

const productCategoryLabels: Record<ProductCategory, string> = {
  ACCESSORIES: "Acessórios",
  STATIONERY: "Papelaria",
  WALLETS: "Carteiras",
  TRAVEL: "Viagem",
  BAGS: "Bolsas",
};

function getProductCategoryLabel(category?: string | null): string {
  return category && category in productCategoryLabels ? productCategoryLabels[category as ProductCategory] : "Sem categoria";
}

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

function createEmptyColorItem(): ColorFormItem {
  return { name: "", qty: "1" };
}

function sumColorQuantity(items: ColorFormItem[]): number {
  return items.reduce((total, item) => {
    const qty = Number(item.qty);
    return Number.isInteger(qty) && qty > 0 ? total + qty : total;
  }, 0);
}

function normalizeColorVariants(items: ColorFormItem[]): ProductColorVariant[] {
  const normalized = items
    .map((item) => ({
      name: item.name.trim(),
      qty: Number(item.qty),
    }))
    .filter((item) => item.name.length > 0 && Number.isInteger(item.qty) && item.qty >= 0);

  const seen = new Set<string>();
  const uniqueItems: ProductColorVariant[] = [];

  for (const item of normalized) {
    const key = item.name.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) {
      throw new Error("Duplicated color in product variants is not allowed");
    }
    seen.add(key);
    uniqueItems.push(item);
  }

  return uniqueItems;
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
  const [adjustStockDialogOpen, setAdjustStockDialogOpen] = useState(false);
  const [adjustStockProduct, setAdjustStockProduct] = useState<CatalogProduct | null>(null);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [materialRowIndex, setMaterialRowIndex] = useState<number | null>(null);
  const [createMaterialForNewRow, setCreateMaterialForNewRow] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [category, setCategory] = useState<ProductCategory>("ACCESSORIES");
  const [description, setDescription] = useState("");
  const [colorVariants, setColorVariants] = useState<ColorFormItem[]>([]);
  const [productMode, setProductMode] = useState<"QUANTITY" | "COLORS">("QUANTITY");
  const [initialStockQty, setInitialStockQty] = useState("0");
  const [hasTechnicalSpec, setHasTechnicalSpec] = useState(false);
  const [bomItems, setBomItems] = useState<BomFormItem[]>([createEmptyBomItem()]);
  const [attachments, setAttachments] = useState<ProductAttachment[]>([]);
  const [attachmentInput, setAttachmentInput] = useState("");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const products = catalogData?.items ?? [];
  const totalProducts = catalogData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));

  const activeMaterials = useMemo(() => materials?.filter((material) => material.isActive === 1) ?? [], [materials]);
  const isSavingProduct = createMutation.isPending || updateMutation.isPending;

  function openAdjustStockDialog(product: CatalogProduct) {
    setAdjustStockProduct(product);
    setAdjustStockDialogOpen(true);
  }

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
    if (!productDialogOpen) return;

    if (editingProduct) {
      setName(editingProduct.name);
      setPrice(editingProduct.price);
      setDiscountPercent(editingProduct.discountPercent ?? "0");
      setCategory(editingProduct.category as ProductCategory);
      setDescription(editingProduct.description ?? "");
      setColorVariants((editingProduct.colorVariants ?? []).map((variant) => ({ name: variant.name, qty: String(variant.qty) })));
      setProductMode((editingProduct.colorVariants ?? []).length > 0 ? "COLORS" : "QUANTITY");
      setInitialStockQty(String(editingProduct.stockQty ?? 0));
      setHasTechnicalSpec(editingProduct.bomItems.length > 0);
      setBomItems(editingProduct.bomItems.length > 0 ? editingProduct.bomItems.map((item) => ({ materialId: item.materialId, qtyPerUnit: String(item.qtyPerUnit) })) : [createEmptyBomItem()]);
      setAttachments((editingProduct.attachments ?? []).map((attachment) => coerceAttachment(attachment as ProductAttachment | string)));
      setAttachmentInput("");
      setAttachmentError(null);
      return;
    }

    setName("");
    setPrice("");
    setDiscountPercent("0");
    setCategory("ACCESSORIES");
    setDescription("");
    setColorVariants([]);
    setProductMode("QUANTITY");
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
  const setColorVariant = (index: number, patch: Partial<ColorFormItem>) => {
    setColorVariants((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };
  const addColorVariant = () => setColorVariants((current) => [...current, createEmptyColorItem()]);
  const removeColorVariant = (index: number) => {
    setColorVariants((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  };
  const enableColorMode = () => {
    setProductMode("COLORS");
    setColorVariants((current) => (current.length > 0 ? current : [createEmptyColorItem()]));
  };
  const enableQuantityMode = () => {
    setProductMode("QUANTITY");
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

  const confirmDeleteProduct = (product: CatalogProduct) => {
    if (window.confirm(`Excluir definitivamente o produto "${product.name}"? Fichas técnicas, estoque produzido, movimentações e registros relacionados também serão apagados.`)) {
      deleteMutation.mutate(product.id, { onSuccess: () => refetchProducts() });
    }
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
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do produto.", variant: "destructive" });
      return;
    }
    if (!price || Number(price) < 0) {
      toast({ title: "Preço inválido", description: "Informe um preço maior ou igual a zero.", variant: "destructive" });
      return;
    }
    if (discountPercent === "" || Number(discountPercent) < 0 || Number(discountPercent) > 100) {
      toast({ title: "Desconto inválido", description: "Informe um desconto percentual entre 0 e 100.", variant: "destructive" });
      return;
    }
    let normalizedColorVariants: ProductColorVariant[] = [];
    try {
      normalizedColorVariants = productMode === "COLORS" ? normalizeColorVariants(colorVariants) : [];
    } catch {
      toast({
        title: "Cores duplicadas",
        description: "Cada cor deve aparecer apenas uma vez no mesmo cadastro.",
        variant: "destructive",
      });
      return;
    }
    if (productMode === "COLORS" && normalizedColorVariants.length === 0) {
      toast({
        title: "Cores obrigatórias",
        description: "Adicione ao menos uma cor válida ou volte para o modo quantidade.",
        variant: "destructive",
      });
      return;
    }

    const normalizedInitialStockQty =
      productMode === "COLORS"
        ? sumColorQuantity(colorVariants)
        : Number(initialStockQty);
    if (!Number.isInteger(normalizedInitialStockQty) || normalizedInitialStockQty < 0) {
      toast({
        title: "Quantidade inicial inválida",
        description: productMode === "COLORS"
          ? "A soma das cores precisa ser um número inteiro maior ou igual a zero."
          : "Informe uma quantidade inteira maior ou igual a zero.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      product: { name, price, discountPercent, category, attachments, colorVariants: normalizedColorVariants, isActive: 1, description },
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

  return (
    <Layout>
      <PageHeader
        title="Catálogo de produtos"
        description="Organize fichas técnicas, estoque e variações de forma simples."
        icon={<Package className="h-6 w-6" />}
        actions={
          <Button onClick={openCreateProductDialog} disabled={!canWrite || isSavingProduct}>
            <Plus className="w-4 h-4 mr-2" /> Novo item
          </Button>
        }
      />

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
            {products.map((item) => (
              <Card key={item.id} className="border-border/70 bg-card/90 shadow-none">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-base font-semibold text-foreground">{item.name}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="w-fit text-[11px]">
                          {getProductCategoryLabel(item.category)}
                        </Badge>
                        {item.bomItems.length > 0 ? (
                          <Badge variant="secondary" className="text-[11px]">{item.bomItems.length} material(is)</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[11px]">Sem ficha técnica</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Saldo</p>
                      <p className="text-sm font-semibold text-foreground">{formatQtyByUom(item.stockQty, "UNIT")}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-muted/40 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Preço</p>
                      <p className="font-medium text-foreground">{brl(Number(item.price))}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Desconto</p>
                      <p className="font-medium text-foreground">{Number(item.discountPercent ?? 0) > 0 ? `${toPtBrDecimal(item.discountPercent)}%` : "—"}</p>
                    </div>
                  </div>

                  {canWrite ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => openAdjustStockDialog(item)}
                        disabled={isSavingProduct}
                      >
                        <ArrowUpDown className="mr-2 h-4 w-4" />
                        Estoque
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => openEditProductDialog(item)}
                        disabled={isSavingProduct}
                      >
                        <PencilLine className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button type="button" variant="destructive" className="w-full" onClick={() => confirmDeleteProduct(item)} disabled={deleteMutation.isPending}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="hidden lg:table-cell">Estrutura de produção</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((item) => {
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="hidden sm:table-cell">#{item.id}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{item.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="w-fit text-[11px]">
                          {getProductCategoryLabel(item.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>{brl(Number(item.price))}</TableCell>
                      <TableCell>{Number(item.discountPercent ?? 0) > 0 ? `${toPtBrDecimal(item.discountPercent)}%` : "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{formatQtyByUom(item.stockQty, "UNIT")}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {item.bomItems.length > 0 ? (
                          <div className="text-sm text-muted-foreground">{`${item.bomItems.length} material(is)`}</div>
                        ) : (
                          <Badge variant="secondary">Sem ficha técnica</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canWrite ? (
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="mr-2 h-9 w-9"
                              onClick={() => openAdjustStockDialog(item)}
                              disabled={isSavingProduct}
                              aria-label={`Ajustar estoque de ${item.name}`}
                              title="Ajustar estoque"
                            >
                              <ArrowUpDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-9 w-9"
                              onClick={() => openEditProductDialog(item)}
                              disabled={isSavingProduct}
                              aria-label={`Editar ${item.name}`}
                              title="Editar"
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="destructive"
                              className="ml-2 h-9 w-9"
                              onClick={() => confirmDeleteProduct(item)}
                              disabled={deleteMutation.isPending}
                              aria-label={`Excluir ${item.name}`}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
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
        <ResponsiveDialogContent className="h-[100dvh] max-w-none overflow-hidden rounded-none border-border bg-card p-0 text-card-foreground shadow-2xl md:h-[90vh] md:max-w-4xl md:rounded-2xl md:p-0">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <ResponsiveDialogHeader className="border-b border-border px-4 pb-4 pt-4 text-left md:px-8 md:pb-5 md:pt-7">
              <div className="space-y-1">
                <ResponsiveDialogTitle className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">
                  {editingProduct ? "Editar item do catálogo" : "Criar item do catálogo"}
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription className="max-w-2xl text-sm text-foreground/75">
                  Cadastre o produto com quantidade simples ou por cores. A ficha técnica continua opcional no cadastro.
                </ResponsiveDialogDescription>
              </div>
            </ResponsiveDialogHeader>

            <form onSubmit={handleProductSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 md:space-y-8 md:px-8 md:py-8">
                <section className="space-y-5">
                  <h3 className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">Informações básicas</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                    <div className="space-y-2 md:col-span-6">
                      <Label className="ml-1 text-sm font-bold text-foreground">Nome</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Bolsa Executiva de Couro" className="h-11 rounded-xl border-border bg-card px-4" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="ml-1 text-sm font-bold text-foreground">Preço</Label>
                      <Input
                        inputMode="decimal"
                        value={toPtBrDecimal(price)}
                        onChange={(e) => setPrice(fromPtBrDecimal(e.target.value, 2))}
                        placeholder="0,00"
                        required
                        className="h-11 rounded-xl border-border bg-card px-4 font-semibold"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="ml-1 text-sm font-bold text-foreground">Desconto (%)</Label>
                      <Input
                        inputMode="decimal"
                        value={toPtBrDecimal(discountPercent)}
                        onChange={(e) => setDiscountPercent(fromPtBrDecimal(e.target.value, 2))}
                        placeholder="0,00"
                        className="h-11 rounded-xl border-border bg-card px-4 font-semibold"
                      />
                      <p className="text-xs text-muted-foreground ml-1">Aplicado automaticamente nas vendas.</p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="ml-1 text-sm font-bold text-foreground">Categoria</Label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as ProductCategory)}
                        className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
                        required
                      >
                        {Object.entries(productCategoryLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <hr className="border-border" />

                <section className="space-y-5 rounded-none border-0 bg-transparent p-0 md:space-y-6 md:rounded-2xl md:border md:border-border md:bg-card md:p-6 md:shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <h4 className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">Estoque inicial</h4>
                      <p className="text-sm text-foreground/75">Por padrão, cadastre somente a quantidade. Se precisar, mude para o modo por cores.</p>
                    </div>
                    <div className="inline-flex w-full rounded-xl border border-border bg-muted/40 p-1 md:w-auto">
                      <Button
                        type="button"
                        size="sm"
                        variant={productMode === "QUANTITY" ? "default" : "ghost"}
                        className="h-9 flex-1 rounded-lg px-4 md:flex-none"
                        onClick={enableQuantityMode}
                      >
                        Quantidade
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={productMode === "COLORS" ? "default" : "ghost"}
                        className="h-9 flex-1 rounded-lg px-4 md:flex-none"
                        onClick={enableColorMode}
                      >
                        Por cores
                      </Button>
                    </div>
                  </div>

                  {productMode === "QUANTITY" ? (
                    <div className="space-y-2">
                      <Label className="ml-1 text-sm font-semibold text-foreground">Quantidade</Label>
                      {editingProduct ? (
                        <div className="rounded-xl border-0 bg-card px-4 py-3 text-sm text-foreground/75 md:border md:border-dashed md:border-border">
                          Estoque atual: <span className="font-semibold text-foreground">{editingProduct.stockQty ?? 0}</span>. A quantidade inicial só é definida na criação.
                        </div>
                      ) : (
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={initialStockQty}
                          onChange={(e) => setInitialStockQty(e.target.value)}
                          placeholder="0"
                          required
                          className="h-11 rounded-xl border-border bg-card px-4"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground">Cores</span>
                        <Badge variant="secondary" className="text-[11px]">{sumColorQuantity(colorVariants)} un</Badge>
                        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={addColorVariant}>
                          <Plus className="mr-2 h-4 w-4" /> Cor
                        </Button>
                      </div>
                      <p className="text-xs text-foreground/70">Ex.: carteira Tani 4 unidades, sendo 2 pretas, 1 marrom e 1 caramelo.</p>

                      <div className="space-y-3">
                        {colorVariants.map((item, index) => (
                          <div
                            key={index}
                            className="grid gap-3 rounded-none border-0 bg-transparent p-0 md:grid-cols-[minmax(0,1fr),120px,44px] md:items-end md:rounded-xl md:border md:border-border md:bg-card md:p-4"
                          >
                            <div className="space-y-2">
                              <Label className="text-sm">Nome da cor</Label>
                              <Input value={item.name} onChange={(e) => setColorVariant(index, { name: e.target.value })} placeholder="Preta" required className="h-11 rounded-xl border-border bg-card px-4" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">Qtd</Label>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={item.qty}
                                onChange={(e) => setColorVariant(index, { qty: e.target.value })}
                                placeholder="1"
                                required
                                className="h-11 rounded-xl border-border bg-card px-4"
                              />
                            </div>
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-muted-foreground hover:text-destructive"
                                onClick={() => removeColorVariant(index)}
                                aria-label="Remover cor"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground/75 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">Resumo:</span>
                          {colorVariants.some((item) => item.name.trim()) ? (
                            colorVariants
                              .filter((item) => item.name.trim())
                              .map((item, index) => (
                                <Badge key={`${item.name}-${index}`} variant="secondary" className="text-[11px]">
                                  {item.name || "Cor"} {item.qty || "0"}
                                </Badge>
                              ))
                          ) : (
                            <span>Adicione uma ou mais cores para continuar.</span>
                          )}
                        </div>
                        <div className="shrink-0">
                          <span className="font-medium text-foreground">Total: </span>
                          {sumColorQuantity(colorVariants)} un
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <hr className="border-border" />

                <section className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">Descrição do produto</h4>
                    <p className="text-sm text-foreground/75">Contexto livre sobre o produto, acabamento ou uso.</p>
                  </div>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Informações adicionais sobre o produto"
                    className="min-h-[140px] rounded-xl border-border bg-card px-4 py-3"
                  />
                </section>

                <hr className="border-border" />

                <section className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm md:space-y-6 md:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">Ficha técnica</h4>
                      <p className="text-sm text-foreground/75">Opcional no cadastro. Obrigatória só para iniciar produção.</p>
                    </div>
                    <Button
                      type="button"
                      variant={hasTechnicalSpec ? "outline" : "default"}
                      size="sm"
                      onClick={() => setHasTechnicalSpec((current) => !current)}
                    >
                      {hasTechnicalSpec ? "Desativar" : "Adicionar"}
                    </Button>
                  </div>

                  {hasTechnicalSpec ? (
                    <div className="space-y-3">
                      {bomItems.length === 0 ? (
                        <div className="rounded-xl border-0 bg-muted/20 px-4 py-4 text-sm text-foreground/70 md:border md:border-dashed md:border-border">
                          Nenhum material na ficha técnica ainda.
                        </div>
                      ) : null}
                      <div className="flex justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={handleCreateNewMaterialFromSpec}>
                          <Plus className="h-4 w-4 mr-1" /> Material
                        </Button>
                      </div>

                      {bomItems.map((item, index) => (
                        <div key={index} className="space-y-3 rounded-none border-0 bg-transparent p-0 md:rounded-xl md:border md:border-border md:bg-card md:p-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Material {index + 1}</h3>
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
                                className="h-11 rounded-xl border-border bg-card px-4"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addBomItem}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-3 text-sm text-foreground/70 transition-colors hover:border-primary hover:text-primary"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar material
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border-0 bg-muted/20 px-4 py-4 text-sm text-foreground/70 md:border md:border-dashed md:border-border">
                      Sem ficha técnica por enquanto. Você poderá adicionar depois editando este mesmo produto.
                    </div>
                  )}
                </section>

                <hr className="border-border" />

                <section className="space-y-5 rounded-none border-0 bg-transparent p-0 md:space-y-6 md:rounded-2xl md:border md:border-border md:bg-card md:p-6 md:shadow-sm">
                  <div className="space-y-1">
                    <h4 className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">Anexos</h4>
                    <p className="text-sm text-foreground/75">Links públicos para imagens ou arquivos do produto.</p>
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
                      className="h-11 rounded-xl border-border bg-card px-4"
                    />
                    <Button type="button" variant="outline" onClick={addAttachment} disabled={!canWrite}>
                      <Plus className="h-4 w-4 mr-2" /> Adicionar
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
                    <div className="rounded-xl border-0 bg-muted/20 px-4 py-6 text-sm text-foreground/70 md:border md:border-dashed md:border-border">
                      Nenhum anexo adicionado.
                    </div>
                  )}
                </section>
              </div>

              <ResponsiveDialogFooter className="shrink-0 border-t border-border bg-card px-4 py-3 md:px-8 md:py-5">
                <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setProductDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="w-full sm:w-auto" disabled={!canWrite || isSavingProduct}>
                    {isSavingProduct ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                      </>
                    ) : (
                      "Salvar Produto"
                    )}
                  </Button>
                </div>
              </ResponsiveDialogFooter>
            </form>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <AdjustProducedStockDialog
        open={adjustStockDialogOpen}
        onOpenChange={(open) => {
          setAdjustStockDialogOpen(open);
          if (!open) setAdjustStockProduct(null);
        }}
        product={adjustStockProduct ? { id: adjustStockProduct.id, name: adjustStockProduct.name, stockQty: Number(adjustStockProduct.stockQty) } : null}
      />

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
