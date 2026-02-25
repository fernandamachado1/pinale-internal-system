import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { useConcludeProductionOrder, useCreateProductionOrder, useProductionOrders, useProducts } from "@/hooks/use-erp";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Factory, Plus } from "lucide-react";

const groupLabels: Record<"LEATHER" | "HARDWARE" | "ADHESIVE" | "THREAD" | "OTHER", string> = {
  LEATHER: "Couro",
  HARDWARE: "Ferragens",
  ADHESIVE: "Adesivos",
  THREAD: "Linha",
  OTHER: "Outros",
};
const statusLabels: Record<"OPEN" | "DONE", string> = {
  OPEN: "Aberta",
  DONE: "Concluída",
};

export default function Production() {
  const { data: orders } = useProductionOrders();
  const { data: products } = useProducts();
  const createMutation = useCreateProductionOrder();
  const concludeMutation = useConcludeProductionOrder();

  const activeProducts = useMemo(() => products?.filter((product) => product.isActive === 1) ?? [], [products]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [qtyPlanned, setQtyPlanned] = useState("1");

  const [concludeOrderId, setConcludeOrderId] = useState<number | null>(null);
  const [materialGroup, setMaterialGroup] = useState<"LEATHER" | "HARDWARE" | "ADHESIVE" | "THREAD" | "OTHER">("LEATHER");
  const [quantityUsed, setQuantityUsed] = useState("1");
  const [thicknessMm, setThicknessMm] = useState("1");
  const [panelsCount, setPanelsCount] = useState("");
  const [note, setNote] = useState("");

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    createMutation.mutate(
      {
        productId: Number(productId),
        qtyPlanned: Number(qtyPlanned),
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setProductId("");
          setQtyPlanned("1");
        },
      },
    );
  };

  const handleConclude = (event: React.FormEvent) => {
    event.preventDefault();
    if (!concludeOrderId) return;

    concludeMutation.mutate(
      {
        id: concludeOrderId,
        data: {
          consumptions: [
            {
              materialGroup,
              quantityUsed,
              thicknessMm,
              panelsCount: panelsCount ? Number(panelsCount) : undefined,
              note: note || undefined,
            },
          ],
        },
      },
      {
        onSuccess: () => {
          setConcludeOrderId(null);
          setQuantityUsed("1");
          setThicknessMm("1");
          setPanelsCount("");
          setNote("");
        },
      },
    );
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Factory className="w-8 h-8 text-primary" />
          Ordens de Produção
        </h1>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Nova OP
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Ordem de Produção</DialogTitle>
              <DialogDescription>Cria a OP no status OPEN.</DialogDescription>
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
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || !productId}>Criar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead>Qtd Planejada</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders?.map((order) => (
            <TableRow key={order.id}>
              <TableCell>#{order.id}</TableCell>
              <TableCell>{order.product.name}</TableCell>
              <TableCell>{order.qtyPlanned}</TableCell>
              <TableCell>
                <Badge variant="outline">{statusLabels[order.status]}</Badge>
              </TableCell>
              <TableCell className="text-right">
                {order.status === "OPEN" ? (
                  <Button size="sm" onClick={() => setConcludeOrderId(order.id)}>Concluir</Button>
                ) : (
                  <span className="text-muted-foreground text-sm">Finalizada</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={concludeOrderId !== null} onOpenChange={(open) => !open && setConcludeOrderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir OP #{concludeOrderId}</DialogTitle>
            <DialogDescription>Informe o consumo variável real (ex: couro).</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConclude} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Select
                  value={materialGroup}
                  onValueChange={(value: "LEATHER" | "HARDWARE" | "ADHESIVE" | "THREAD" | "OTHER") => setMaterialGroup(value)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["LEATHER", "HARDWARE", "ADHESIVE", "THREAD", "OTHER"] as const).map((group) => (
                      <SelectItem key={group} value={group}>{groupLabels[group]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantidade usada</Label>
                <Input type="number" step="0.001" value={quantityUsed} onChange={(e) => setQuantityUsed(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Espessura (mm)</Label>
                <Input type="number" step="0.001" value={thicknessMm} onChange={(e) => setThicknessMm(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Quantidade de painéis</Label>
                <Input type="number" value={panelsCount} onChange={(e) => setPanelsCount(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nota</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConcludeOrderId(null)}>Cancelar</Button>
              <Button type="submit" disabled={concludeMutation.isPending}>Concluir OP</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
