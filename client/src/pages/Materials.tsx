import { useMemo, useState } from "react";
import type { Material } from "@shared/schema";
import { Layout } from "@/components/Layout";
import { useDeleteMaterial, useMaterials } from "@/hooks/use-erp";
import { MaterialDialog } from "@/components/materials/MaterialDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Plus } from "lucide-react";
import { brl } from "@/lib/format";

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

  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  const filtered = useMemo(
    () => materials?.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase())) ?? [],
    [materials, searchTerm],
  );

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Layers className="w-8 h-8 text-primary" />
          Materiais
        </h1>

        <Button onClick={() => setIsCreateOpen(true)}>
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
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Unidade de medida</TableHead>
                  <TableHead className="text-right">Valor compra</TableHead>
                  <TableHead className="text-right">Valor por m²</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>#{item.id}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{categoryLabels[item.category]}</TableCell>
                    <TableCell>{unitLabels[item.unitOfMeasure]}</TableCell>
                    <TableCell className="text-right">{brl(Number(item.purchasePrice))}</TableCell>
                    <TableCell className="text-right">
                      {item.pricePerSquareMeter ? brl(Number(item.pricePerSquareMeter)) : "-"}
                    </TableCell>
                    <TableCell className="text-right">{item.stockQty}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingMaterial(item)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(item.id)}>
                        Inativar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
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
            <Button onClick={() => setIsCreateOpen(true)}>
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
