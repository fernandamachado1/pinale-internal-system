import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useProducts, useCreateProduct, useMaterials } from "@/hooks/use-erp";
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Search, Package, Trash2, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SpecItem {
  materialId: string;
  quantityRequired: string;
}

export default function Products() {
  const { data: products, isLoading } = useProducts();
  const { data: materials } = useMaterials();
  const createMutation = useCreateProduct();
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [specs, setSpecs] = useState<SpecItem[]>([]);

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddSpec = () => {
    setSpecs([...specs, { materialId: "", quantityRequired: "1" }]);
  };

  const handleRemoveSpec = (index: number) => {
    setSpecs(specs.filter((_, i) => i !== index));
  };

  const handleSpecChange = (index: number, field: keyof SpecItem, value: string) => {
    const newSpecs = [...specs];
    newSpecs[index][field] = value;
    setSpecs(newSpecs);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      product: {
        name,
        price,
        quantity: 0
      },
      specs: specs
        .filter(s => s.materialId && Number(s.quantityRequired) > 0)
        .map(s => ({
          materialId: parseInt(s.materialId),
          quantityRequired: s.quantityRequired
        }))
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        setIsOpen(false);
        setName("");
        setPrice("");
        setSpecs([]);
      }
    });
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Package className="w-8 h-8 text-primary" />
            Produtos
          </h1>
          <p className="text-muted-foreground mt-1">Catálogo de produtos e fichas técnicas.</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
              <Plus className="w-4 h-4 mr-2" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cadastrar Produto</DialogTitle>
              <DialogDescription>
                Defina o produto e seus insumos necessários (Ficha Técnica).
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Produto</Label>
                  <Input 
                    id="name" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Camiseta Básica"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Preço de Venda (R$)</Label>
                  <Input 
                    id="price" 
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    required 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Ficha Técnica (Insumos)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddSpec}>
                    <Plus className="w-3 h-3 mr-2" />
                    Adicionar Insumo
                  </Button>
                </div>
                
                <div className="bg-muted/50 rounded-lg p-4 space-y-3 max-h-[200px] overflow-y-auto">
                  {specs.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-2">
                      Nenhum insumo adicionado à ficha técnica.
                    </div>
                  )}
                  {specs.map((spec, index) => (
                    <div key={index} className="flex gap-3 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Insumo</Label>
                        <Select 
                          value={spec.materialId} 
                          onValueChange={(val) => handleSpecChange(index, 'materialId', val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {materials?.map(m => (
                              <SelectItem key={m.id} value={String(m.id)}>
                                {m.name} ({m.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24 space-y-1">
                        <Label className="text-xs text-muted-foreground">Qtd</Label>
                        <Input 
                          type="number" 
                          step="0.01"
                          value={spec.quantityRequired}
                          onChange={(e) => handleSpecChange(index, 'quantityRequired', e.target.value)}
                        />
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveSpec(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Salvar Produto"}
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
            placeholder="Buscar produtos..." 
            className="border-none bg-transparent shadow-none focus-visible:ring-0 max-w-sm p-0 h-auto"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Insumos (Ficha Técnica)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts?.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/50 transition-colors">
                <TableCell className="font-medium text-muted-foreground">#{item.id}</TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>R$ {Number(item.price).toFixed(2)}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell className="max-w-[300px]">
                  <div className="flex flex-wrap gap-1">
                    {item.technicalSpecs?.map((spec, i) => (
                      <span key={i} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full border border-border/50">
                        {spec.material.name}: {spec.quantityRequired}{spec.material.unit}
                      </span>
                    ))}
                    {!item.technicalSpecs?.length && <span className="text-xs text-muted-foreground">-</span>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!filteredProducts?.length && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Layout>
  );
}
