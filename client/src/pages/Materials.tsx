import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useMaterials, useCreateMaterial } from "@/hooks/use-erp";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Layers, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Materials() {
  const { data: materials, isLoading } = useMaterials();
  const createMutation = useCreateMaterial();
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    unit: "",
    quantity: "0"
  });

  const filteredMaterials = materials?.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData, {
      onSuccess: () => {
        setIsOpen(false);
        setFormData({ name: "", unit: "", quantity: "0" });
      }
    });
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Layers className="w-8 h-8 text-primary" />
            Insumos
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie seu estoque de matérias-primas.</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
              <Plus className="w-4 h-4 mr-2" />
              Novo Insumo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Insumo</DialogTitle>
              <DialogDescription>
                Cadastre uma nova matéria-prima no sistema.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Insumo</Label>
                <Input 
                  id="name" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ex: Tecido Algodão"
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit">Unidade (Kg, M, Un)</Label>
                  <Input 
                    id="unit" 
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    placeholder="Ex: m"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Estoque Inicial</Label>
                  <Input 
                    id="quantity" 
                    type="number"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                    required 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Salvar Insumo"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/30 flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar insumos..." 
            className="border-none bg-transparent shadow-none focus-visible:ring-0 max-w-sm p-0 h-auto"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Estoque Atual</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaterials?.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium text-muted-foreground">#{item.id}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(item.quantity).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(item.quantity) < 10 ? (
                      <Badge variant="destructive" className="font-normal">Baixo Estoque</Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 font-normal">Regular</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!filteredMaterials?.length && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Nenhum insumo encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </Layout>
  );
}
