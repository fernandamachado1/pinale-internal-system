import { useMemo, useState } from "react";
import type { Material } from "@shared/schema";
import { ArrowRight, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type MaterialSelectValue = {
  materialId: number | null;
  materialName: string;
};

interface MaterialSelectFieldProps {
  materials: Material[];
  value: MaterialSelectValue;
  onChange: (next: MaterialSelectValue) => void;
  placeholder?: string;
}

export function MaterialSelectField({
  materials,
  value,
  onChange,
  placeholder = "Buscar material ou digitar nome",
}: MaterialSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel = useMemo(() => {
    if (value.materialId) {
      return materials.find((material) => material.id === value.materialId)?.name ?? value.materialName;
    }
    return value.materialName || placeholder;
  }, [materials, placeholder, value.materialId, value.materialName]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((material) => material.name.toLowerCase().includes(q));
  }, [materials, query]);

  const canUseFreeText = query.trim().length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Nenhum material encontrado.</CommandEmpty>

            {canUseFreeText ? (
              <>
                <CommandGroup>
                  <CommandItem
                    value={`__free__${query}`}
                    onSelect={() => {
                      const name = query.trim();
                      onChange({ materialId: null, materialName: name });
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.materialId === null && value.materialName.trim().toLowerCase() === query.trim().toLowerCase()
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <span className="truncate">{`Usar "${query.trim()}"`}</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            ) : null}

            <CommandGroup>
              {filtered.map((material) => (
                <CommandItem
                  key={material.id}
                  value={material.name}
                  onSelect={() => {
                    onChange({ materialId: material.id, materialName: material.name });
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value.materialId === material.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{material.name}</span>
                  {material.stockTracked === false ? (
                    <Badge variant="secondary" className="ml-auto gap-1 text-[10px] font-medium">
                      <ArrowRight className="h-3 w-3" />
                      Sem controle
                    </Badge>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>

            {value.materialId || value.materialName ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onChange({ materialId: null, materialName: "" });
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    Limpar
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
