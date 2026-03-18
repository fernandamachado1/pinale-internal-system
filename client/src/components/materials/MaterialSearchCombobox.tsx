import { useMemo, useState } from "react";
import type { Material } from "@shared/schema";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MaterialSearchComboboxProps {
  materials: Material[];
  value?: number;
  onSelect: (material: Material) => void;
  placeholder?: string;
}

export function MaterialSearchCombobox({
  materials,
  value,
  onSelect,
  placeholder = "Pesquisar material",
}: MaterialSearchComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedMaterial = useMemo(
    () => materials.find((material) => material.id === value),
    [materials, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          <span className="truncate">{selectedMaterial?.name ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>Nenhum material encontrado.</CommandEmpty>
            <CommandGroup>
              {materials.map((material) => (
                <CommandItem
                  key={material.id}
                  value={material.name}
                  onSelect={() => {
                    onSelect(material);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === material.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{material.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
