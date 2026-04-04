import { useMemo, useState } from "react";
import type { Material } from "@shared/schema";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { useDeleteMaterial, useMaterials } from "@/hooks/use-erp";
import { MaterialDialog } from "@/components/materials/MaterialDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Layers, MoreVertical, Plus } from "lucide-react";
import { brl } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";

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

  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  const filtered = useMemo(
    () => materials?.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase())) ?? [],
    [materials, searchTerm],
  );

  const openCreate = () => {
    if (isMobile) {
      navigate("/materials/new");
      return;
    }
    setIsCreateOpen(true);
  };

  const openEdit = (item: Material) => {
    if (isMobile) {
      navigate(`/materials/${item.id}/edit`);
      return;
    }
    setEditingMaterial(item);
  };

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Layers className="w-8 h-8 text-primary" />
          Materiais
        </h1>

        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Novo Material
        </Button>
      </div>

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden lg:table-cell">Unidade de medida</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Valor compra</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Valor por m²</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Total m²</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const isRawMaterial = item.category === "RAW_MATERIAL";
                  const pricePerSquareMeter = item.pricePerSquareMeter === null ? null : Number(item.pricePerSquareMeter);
                  const totalPerSquareMeter = isRawMaterial && pricePerSquareMeter !== null
                    ? pricePerSquareMeter * Number(item.stockQty)
                    : null;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="hidden sm:table-cell">#{item.id}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{categoryLabels[item.category]}</TableCell>
                      <TableCell className="hidden lg:table-cell">{unitLabels[item.unitOfMeasure]}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right">{isRawMaterial ? "-" : brl(Number(item.purchasePrice))}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right">{pricePerSquareMeter !== null ? brl(pricePerSquareMeter) : "-"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right">{totalPerSquareMeter !== null ? brl(totalPerSquareMeter) : "-"}</TableCell>
                      <TableCell className="text-right">{item.stockQty}</TableCell>
                      <TableCell className="text-right">
                        <div className="hidden sm:flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(item.id)}
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
                                onSelect={() => deleteMutation.mutate(item.id)}
                              >
                                Inativar
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
            <Button onClick={openCreate}>
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
