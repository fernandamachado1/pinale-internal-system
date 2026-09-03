import { useMemo, useState } from "react";
import type { Material } from "@shared/schema";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { useDeleteMaterial, useMaterials } from "@/hooks/use-erp";
import { MaterialDialog } from "@/components/materials/MaterialDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowRight, Layers, MoreVertical, Plus } from "lucide-react";
import { brl, formatQtyByUom } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthz } from "@/hooks/use-authz";

const categoryLabels: Record<Material["category"], string> = {
  PACKAGING: "Embalagens",
  NOTIONS: "Aviamentos",
  RAW_MATERIAL: "Matéria-prima",
};

const unitLabels: Record<Material["unitOfMeasure"], string> = {
  UNIT: "Unidade",
  SQUARE_METER: "Metro quadrado",
  METER: "Metro",
};

export default function Materials() {
  const { data: materials, isLoading, error, refetch } = useMaterials();
  const deleteMutation = useDeleteMaterial();
  const isMobile = useIsMobile();
  const [, navigate] = useLocation();
  const { canWrite } = useAuthz();

  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  const filtered = useMemo(
    () => materials?.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase())) ?? [],
    [materials, searchTerm],
  );

  const openCreate = () => {
    if (!canWrite) return;
    if (isMobile) {
      navigate("/materials/new");
      return;
    }
    setIsCreateOpen(true);
  };

  const openEdit = (item: Material) => {
    if (!canWrite) return;
    if (isMobile) {
      navigate(`/materials/${item.id}/edit`);
      return;
    }
    setEditingMaterial(item);
  };

  const confirmDelete = (item: Material) => {
    if (window.confirm(`Excluir definitivamente o material "${item.name}"? Dados relacionados, como fichas técnicas e movimentações, também serão apagados.`)) {
      deleteMutation.mutate(item.id);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Materiais"
        description="Cadastre insumos, acompanhe estoque e mantenha a base de produção organizada."
        icon={<Layers className="h-6 w-6" />}
        actions={
          <Button onClick={openCreate} disabled={!canWrite}>
            <Plus className="w-4 h-4 mr-2" /> Novo material
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Não foi possível carregar os materiais</AlertTitle>
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
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </div>
      ) : materials?.length ? (
        <>
          <div className="mb-4">
            <Input placeholder="Buscar material" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          {filtered.length ? (
            <>
              <div className="space-y-3 md:hidden">
                {filtered.map((item) => {
                  const isRawMaterial = item.category === "RAW_MATERIAL";
                  const pricePerSquareMeter = item.pricePerSquareMeter === null ? null : Number(item.pricePerSquareMeter);
                  const totalPerSquareMeter = isRawMaterial && item.stockTracked !== false && pricePerSquareMeter !== null
                    ? pricePerSquareMeter * Number(item.stockQty)
                    : null;

                  return (
                    <Card key={item.id} className="border-border/70 bg-card/90 shadow-none">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-base font-semibold text-foreground">{item.name}</p>
                              {item.stockTracked === false ? (
                                <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
                                  <ArrowRight className="h-3 w-3" />
                                  Sem controle
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">#{item.id} • {categoryLabels[item.category]} • {unitLabels[item.unitOfMeasure]}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Estoque</p>
                            <p className="text-sm font-semibold text-foreground">
                              {item.stockTracked === false ? "Sem controle" : formatQtyByUom(item.stockQty, item.unitOfMeasure)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-xl bg-muted/40 px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">Compra</p>
                            <p className="font-medium text-foreground">{isRawMaterial ? "-" : brl(Number(item.purchasePrice))}</p>
                          </div>
                          <div className="rounded-xl bg-muted/40 px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">m²</p>
                            <p className="font-medium text-foreground">{pricePerSquareMeter !== null ? brl(pricePerSquareMeter) : "-"}</p>
                          </div>
                          <div className="rounded-xl bg-muted/40 px-3 py-2 col-span-2">
                            <p className="text-[11px] text-muted-foreground">Total em estoque</p>
                            <p className="font-medium text-foreground">{totalPerSquareMeter !== null ? brl(totalPerSquareMeter) : "-"}</p>
                          </div>
                        </div>

                        {canWrite ? (
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="w-full" onClick={() => openEdit(item)}>
                              Editar
                            </Button>
                            <Button
                              variant="destructive"
                              className="w-full"
                              disabled={deleteMutation.isPending}
                              onClick={() => confirmDelete(item)}
                            >
                              Excluir
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
                      <TableHead className="hidden sm:table-cell">ID</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="hidden md:table-cell">Categoria</TableHead>
                      <TableHead className="hidden lg:table-cell">Unidade de medida</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">Valor compra</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">Valor por m²</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">Valor total em estoque</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => {
                      const isRawMaterial = item.category === "RAW_MATERIAL";
                      const pricePerSquareMeter = item.pricePerSquareMeter === null ? null : Number(item.pricePerSquareMeter);
                      const totalPerSquareMeter = isRawMaterial && item.stockTracked !== false && pricePerSquareMeter !== null
                        ? pricePerSquareMeter * Number(item.stockQty)
                        : null;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="hidden sm:table-cell">#{item.id}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{item.name}</span>
                              {item.stockTracked === false ? (
                                <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
                                  <ArrowRight className="h-3 w-3" />
                                  Sem controle
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{categoryLabels[item.category]}</TableCell>
                          <TableCell className="hidden lg:table-cell">{unitLabels[item.unitOfMeasure]}</TableCell>
                          <TableCell className="hidden lg:table-cell text-right">{isRawMaterial ? "-" : brl(Number(item.purchasePrice))}</TableCell>
                          <TableCell className="hidden lg:table-cell text-right">{pricePerSquareMeter !== null ? brl(pricePerSquareMeter) : "-"}</TableCell>
                          <TableCell className="hidden lg:table-cell text-right">{totalPerSquareMeter !== null ? brl(totalPerSquareMeter) : "-"}</TableCell>
                          <TableCell className="text-right">
                            {item.stockTracked === false ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                <ArrowRight className="h-3.5 w-3.5" />
                                Sem controle
                              </span>
                            ) : (
                              formatQtyByUom(item.stockQty, item.unitOfMeasure)
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {canWrite ? (
                              <>
                                <div className="hidden sm:flex justify-end gap-2">
                                  <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                                    Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={deleteMutation.isPending}
                                    onClick={() => confirmDelete(item)}
                                  >
                                    Inativar
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
                                      <DropdownMenuItem onSelect={() => openEdit(item)}>Editar</DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        disabled={deleteMutation.isPending}
                                        onSelect={() => confirmDelete(item)}
                                      >
                                        Excluir
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
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Nenhum material encontrado</CardTitle>
                <CardDescription>Tente ajustar o termo de busca.</CardDescription>
              </CardHeader>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Comece cadastrando seus materiais</CardTitle>
            <CardDescription>Materiais alimentam a ficha técnica e o consumo na produção.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openCreate} disabled={!canWrite}>
              <Plus className="w-4 h-4 mr-2" /> Novo Material
            </Button>
          </CardContent>
        </Card>
      )}

      <MaterialDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <MaterialDialog open={editingMaterial !== null} onOpenChange={(open) => !open && setEditingMaterial(null)} editMaterial={editingMaterial} />
    </Layout>
  );
}
