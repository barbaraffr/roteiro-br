import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { MapPin, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CitySelection {
  placeId: string;
  description: string;
  mainText: string;
}

interface CityAutocompleteProps {
  label: string;
  placeholder: string;
  value: CitySelection | null;
  onChange: (selection: CitySelection | null) => void;
  icon?: React.ReactNode;
}

export function CityAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  icon,
}: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue]);

  const { data, isLoading } = trpc.trips.autocomplete.useQuery(
    { query: debouncedQuery },
    {
      enabled: debouncedQuery.length >= 2 && open,
      staleTime: 30_000,
    }
  );

  const handleSelect = useCallback(
    (placeId: string, description: string, mainText: string) => {
      onChange({ placeId, description, mainText });
      setInputValue("");
      setDebouncedQuery("");
      setOpen(false);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange(null);
    setInputValue("");
    setDebouncedQuery("");
  }, [onChange]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground/80">{label}</label>
      <div className="relative">
        {value ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-input bg-card px-3.5 py-2.5 card-elegant transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              {icon ?? <MapPin className="h-4 w-4 text-primary shrink-0" />}
              <span className="text-sm font-medium truncate">{value.description}</span>
            </div>
            <button
              onClick={handleClear}
              className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Limpar seleção"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {icon ?? <MapPin className="h-4 w-4" />}
                </div>
                <Input
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    if (!open) setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  placeholder={placeholder}
                  className="pl-10 pr-4 py-2.5 card-elegant border-input bg-card transition-all focus-visible:ring-2 focus-visible:ring-ring/30"
                />
                {isLoading && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent
              className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[280px]"
              align="start"
              sideOffset={4}
            >
              <Command shouldFilter={false}>
                <CommandList>
                  <CommandEmpty>
                    {debouncedQuery.length < 2
                      ? "Digite pelo menos 2 caracteres..."
                      : "Nenhuma cidade encontrada."}
                  </CommandEmpty>
                  <CommandGroup>
                    {data?.predictions.map((p) => (
                      <CommandItem
                        key={p.placeId}
                        value={p.placeId}
                        onSelect={() =>
                          handleSelect(p.placeId, p.description, p.mainText)
                        }
                        className="gap-2.5"
                      >
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">
                            {p.mainText}
                          </span>
                          {p.secondaryText && (
                            <span className="text-xs text-muted-foreground truncate">
                              {p.secondaryText}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
