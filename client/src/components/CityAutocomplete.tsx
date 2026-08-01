import { useState, useEffect, useRef, useCallback, useId } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { MapPin, Loader2, X, LocateFixed } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  /** Show "use current location" control (typically for origin). */
  allowCurrentLocation?: boolean;
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Permissão de localização negada. Ative nas configurações do navegador.";
    case error.POSITION_UNAVAILABLE:
      return "Não foi possível obter a localização atual.";
    case error.TIMEOUT:
      return "Tempo esgotado ao obter a localização. Tente novamente.";
    default:
      return "Erro ao obter a localização atual.";
  }
}

export function CityAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  icon,
  allowCurrentLocation = false,
}: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [locating, setLocating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const utils = trpc.useUtils();

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

  const predictions = data?.predictions ?? [];

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

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

  const handleUseCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error("Seu navegador não suporta geolocalização.");
      return;
    }

    setLocating(true);
    setOpen(false);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 60_000,
        });
      });

      const { latitude: lat, longitude: lng } = position.coords;
      const place = await utils.trips.reverseGeocode.fetch({ lat, lng });

      onChange({
        placeId: place.placeId,
        description: place.description,
        mainText: place.mainText,
      });
      setInputValue("");
      setDebouncedQuery("");
      toast.success("Localização atual definida como origem.");
    } catch (error) {
      if (error instanceof GeolocationPositionError) {
        toast.error(geolocationErrorMessage(error));
      } else if (error && typeof error === "object" && "message" in error) {
        toast.error(String((error as { message: unknown }).message));
      } else {
        toast.error("Erro ao obter a localização atual.");
      }
    } finally {
      setLocating(false);
    }
  }, [onChange, utils.trips.reverseGeocode]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (predictions.length === 0) return;
        setActiveIndex((current) => {
          const next = event.key === "ArrowDown" ? current + 1 : current - 1;
          return (next + predictions.length) % predictions.length;
        });
        return;
      }

      if (event.key === "Enter") {
        const active = predictions[activeIndex];
        if (open && active) {
          event.preventDefault();
          handleSelect(active.placeId, active.description, active.mainText);
        }
      }
    },
    [open, predictions, activeIndex, handleSelect]
  );

  const showEmptyState = !isLoading && predictions.length === 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-foreground/80">{label}</label>
        {allowCurrentLocation && (
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-60 transition-colors"
          >
            {locating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LocateFixed className="h-3.5 w-3.5" />
            )}
            {locating ? "Localizando..." : "Usar minha localização"}
          </button>
        )}
      </div>
      <div className="relative">
        {value ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-input bg-card px-3.5 py-2.5 card-elegant transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              {icon ?? <MapPin className="h-4 w-4 text-primary shrink-0" />}
              <span className="text-sm font-medium truncate">{value.description}</span>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Limpar seleção"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            {/* Anchor (not Trigger) so clicking the field never toggles the popover shut */}
            <PopoverAnchor asChild>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  {icon ?? <MapPin className="h-4 w-4" />}
                </div>
                <Input
                  ref={inputRef}
                  value={inputValue}
                  role="combobox"
                  aria-expanded={open}
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  autoComplete="off"
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    if (!open) setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className={cn(
                    "pl-10 py-2.5 card-elegant border-input bg-card transition-all focus-visible:ring-2 focus-visible:ring-ring/30",
                    allowCurrentLocation || isLoading ? "pr-10" : "pr-4"
                  )}
                />
                {(isLoading || locating) && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </PopoverAnchor>
            <PopoverContent
              className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[280px]"
              align="start"
              sideOffset={4}
              // Keep the caret in the input while the suggestion list is open
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <div
                id={listboxId}
                role="listbox"
                className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1"
              >
                {showEmptyState ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {debouncedQuery.length < 2
                      ? "Digite pelo menos 2 caracteres..."
                      : "Nenhuma cidade encontrada."}
                  </p>
                ) : (
                  predictions.map((p, index) => (
                    <div
                      key={`${p.placeId}-${index}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      // Prevent the mousedown from stealing focus from the input
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() =>
                        handleSelect(p.placeId, p.description, p.mainText)
                      }
                      className={cn(
                        "relative flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm select-none",
                        index === activeIndex && "bg-accent text-accent-foreground"
                      )}
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
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
