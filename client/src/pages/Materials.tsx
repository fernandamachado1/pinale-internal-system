import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { useCreateMaterial, useDeleteMaterial, useMaterials, useUpdateMaterial } from "@/hooks/use-erp";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Layers, Plus } from "lucide-react";

const groups = ["LEATHER", "HARDWARE", "ADHESIVE", "THREAD", "OTHER"] as const;
const policyLabels: Record<"STOCK_CONTROLLED" | "CONSUMPTION_TRACKED", string> = {
  STOCK_CONTROLLED: "Controlado por estoque",
  CONSUMPTION_TRACKED: "Consumo registrado",
};
const groupLabels: Record<(typeof groups)[number], string> = {
  LEATHER: "Couro",
  HARDWARE: "Ferragens",
  ADHESIVE: "Adesivos",
  THREAD: "Linha",
  OTHER: "Outros",
};

export default function Materials() {
  const { data: materials } = useMaterials();
  const createMutation = useCreateMaterial();
  const updateMutation = useUpdateMaterial();
  const deleteMutation = useDeleteMaterial();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    unit: "UN",
    policy: "STOCK_CONTROLLED" as "STOCK_CONTROLLED" | "CONSUMPTION_TRACKED",
    stockQty: "0",
    group: "OTHER" as (typeof groups)[number],
    isActive: 1,
  });

  const filtered = useMemo(
    () => materials?.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase())) ?? [],
    [materials, searchTerm],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    createMutation.mutate(
      {
        name: formData.name,
        unit: formData.unit,
        policy: formData.policy,
        stockQty: formData.policy === "STOCK_CONTROLLED" ? formData.stockQty : null,
        group: formData.group,
        isActive: 1,
      },
      {
        onSuccess: () => {
          setIsOpen(false);
          setFormData({ name: "", unit: "UN", policy: "STOCK_CONTROLLED", stockQty: "0", group: "OTHER", isActive: 1 });
        },
      },
    );
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Layers className="w-8 h-8 text-primary" />
          Materiais
        </h1>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Novo Material
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Material</DialogTitle>
              <DialogDescription>Cadastre o material e defina como ele será controlado.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Grupo do material</Label>
                  <Select value={formData.group} onValueChange={(value: (typeof groups)[number]) => setFormData({ ...formData, group: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => <SelectItem key={group} value={group}>{groupLabels[group]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo de controle</Label>
                  <Select
                    value={formData.policy}
                    onValueChange={(value: "STOCK_CONTROLLED" | "CONSUMPTION_TRACKED") => setFormData({ ...formData, policy: value })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STOCK_CONTROLLED">{policyLabels.STOCK_CONTROLLED}</SelectItem>
                      <SelectItem value="CONSUMPTION_TRACKED">{policyLabels.CONSUMPTION_TRACKED}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estoque inicial</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.stockQty}
                    onChange={(e) => setFormData({ ...formData, stockQty: e.target.value })}
                    disabled={formData.policy === "CONSUMPTION_TRACKED"}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4">
        <Input placeholder="Buscar material" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Controle</TableHead>
            <TableHead>Grupo</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead className="text-right">Estoque</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((item) => (
            <TableRow key={item.id}>
              <TableCell>#{item.id}</TableCell>
              <TableCell>{item.name}</TableCell>
              <TableCell><Badge variant="outline">{policyLabels[item.policy]}</Badge></TableCell>
              <TableCell>{groupLabels[item.group]}</TableCell>
              <TableCell>{item.unit}</TableCell>
              <TableCell className="text-right">{item.stockQty ?? "-"}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updateMutation.isPending}
                  onClick={() => {
                    const name = window.prompt("Nome", item.name);
                    if (!name) return;
                    updateMutation.mutate({ id: item.id, data: { name } });
                  }}
                >
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
    </Layout>
  );
}
