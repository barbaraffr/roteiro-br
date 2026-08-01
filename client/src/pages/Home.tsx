import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { CityAutocomplete, type CitySelection } from "@/components/CityAutocomplete";
import { TripMap } from "@/components/TripMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  MapPin,
  Navigation,
  Fuel,
  DollarSign,
  Clock,
  Route as RouteIcon,
  Loader2,
  ArrowRightLeft,
  CircleDollarSign,
  Wallet,
  Sparkles,
  Repeat2,
} from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDistance = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value) + " km";

export default function Home() {
  const [origin, setOrigin] = useState<CitySelection | null>(null);
  const [destination, setDestination] = useState<CitySelection | null>(null);
  const [fuelConsumption, setFuelConsumption] = useState("10");
  const [fuelPrice, setFuelPrice] = useState("5.89");
  const [roundTrip, setRoundTrip] = useState(false);

  const calculateMutation = trpc.trips.calculate.useMutation({
    onError: (err) => {
      toast.error(err.message || "Erro ao calcular rota. Tente novamente.");
    },
  });

  const result = calculateMutation.data;

  const handleSwapCities = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
  }, [origin, destination]);

  const handleCalculate = useCallback(() => {
    if (!origin || !destination) {
      toast.error("Selecione a cidade de origem e destino.");
      return;
    }
    const consumption = parseFloat(fuelConsumption);
    const price = parseFloat(fuelPrice);
    if (!consumption || consumption <= 0) {
      toast.error("Informe o consumo do veículo (km/l).");
      return;
    }
    if (!price || price <= 0) {
      toast.error("Informe o preço do combustível (R$/litro).");
      return;
    }
    calculateMutation.mutate({
      originPlaceId: origin.placeId,
      destinationPlaceId: destination.placeId,
      originName: origin.description,
      destinationName: destination.description,
      fuelConsumption: consumption,
      fuelPrice: price,
      roundTrip,
    });
  }, [origin, destination, fuelConsumption, fuelPrice, roundTrip, calculateMutation]);

  const canCalculate = origin && destination && fuelConsumption && fuelPrice;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center h-16">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Navigation className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Roteiro<span className="text-primary">BR</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">
                Calculadora de Viagem
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="hero-gradient border-b border-border/40">
        <div className="container py-12 sm:py-16 lg:py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary mb-5">
              <Sparkles className="h-3.5 w-3.5" />
              Planeje sua viagem com precisão
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mb-4">
              Calcule o custo da sua
              <span className="text-primary"> viagem de carro </span>
              entre cidades brasileiras
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
              Descubra a distância, tempo estimado, gasto com combustível e pedágios
              entre qualquer cidade do Brasil — ida ou ida e volta.
            </p>
          </div>
        </div>
      </section>

      <main className="container py-8 sm:py-12">
        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 card-elegant border-border/60">
              <div className="flex items-center gap-2 mb-5">
                <RouteIcon className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Dados da viagem</h2>
              </div>

              <div className="space-y-4">
                <CityAutocomplete
                  label="Origem"
                  placeholder="Digite a cidade de origem..."
                  value={origin}
                  onChange={setOrigin}
                  icon={<MapPin className="h-4 w-4 text-primary" />}
                />

                <div className="flex justify-center -my-1">
                  <button
                    type="button"
                    onClick={handleSwapCities}
                    disabled={!origin && !destination}
                    title="Inverter origem e destino"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-muted border-2 border-background shadow-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                  </button>
                </div>

                <CityAutocomplete
                  label="Destino"
                  placeholder="Digite a cidade de destino..."
                  value={destination}
                  onChange={setDestination}
                  icon={<Navigation className="h-4 w-4 text-primary" />}
                />

                <label className="flex items-center gap-3 rounded-lg border border-input bg-card px-3.5 py-3 cursor-pointer hover:border-primary/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={roundTrip}
                    onChange={(e) => setRoundTrip(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <div className="flex items-center gap-2 min-w-0">
                    <Repeat2 className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium block">Ida e volta</span>
                      <span className="text-xs text-muted-foreground">
                        Calcula o caminho inverso e soma os dois sentidos
                      </span>
                    </div>
                  </div>
                </label>

                <Separator className="my-4" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                      <Fuel className="h-3.5 w-3.5 text-muted-foreground" />
                      Consumo (km/l)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={fuelConsumption}
                      onChange={(e) => setFuelConsumption(e.target.value)}
                      placeholder="10"
                      className="card-elegant"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      Combustível (R$/l)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={fuelPrice}
                      onChange={(e) => setFuelPrice(e.target.value)}
                      placeholder="5.89"
                      className="card-elegant"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleCalculate}
                  disabled={!canCalculate || calculateMutation.isPending}
                  className="w-full h-11 mt-2 text-base font-semibold"
                >
                  {calculateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Calculando...
                    </>
                  ) : (
                    <>
                      <RouteIcon className="h-4 w-4 mr-2" />
                      {roundTrip ? "Calcular Ida e Volta" : "Calcular Viagem"}
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {result && (
              <Card className="p-6 card-elegant border-border/60 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">
                    {result.roundTrip ? "Resumo — ida e volta" : "Resumo da viagem"}
                  </h2>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2.5 px-3.5 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2.5">
                      <RouteIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Distância</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatDistance(result.distanceKm)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2.5 px-3.5 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2.5">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Tempo estimado</span>
                    </div>
                    <span className="text-sm font-semibold">{result.durationText}</span>
                  </div>

                  <div className="flex items-center justify-between py-2.5 px-3.5 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2.5">
                      <Fuel className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Combustível</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatCurrency(result.fuelCost)}
                    </span>
                  </div>

                  <div className="py-2.5 px-3.5 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Pedágios{" "}
                          {result.estimatedTollPlazas > 0 &&
                            `(${result.estimatedTollPlazas} ${
                              result.estimatedTollPlazas === 1 ? "praça" : "praças"
                            })`}
                        </span>
                      </div>
                      <span className="text-sm font-semibold">
                        {formatCurrency(result.tollCost)}
                      </span>
                    </div>

                    {result.tollPlazas.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-border/50 pt-2">
                        {result.tollPlazas.map((plaza, index) => (
                          <li
                            key={`${plaza.direction}-${plaza.name}-${index}`}
                            className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                          >
                            <span className="truncate">
                              {result.roundTrip && (
                                <span className="text-primary/80 font-medium mr-1">
                                  {plaza.direction === "ida" ? "Ida:" : "Volta:"}
                                </span>
                              )}
                              {plaza.name}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {formatCurrency(plaza.price)}
                              {!plaza.priceFromOsm && " *"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {result.roundTrip && result.outbound && result.return && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-border/60 px-3 py-2">
                        <p className="font-medium text-foreground mb-1">Ida</p>
                        <p className="text-muted-foreground">
                          {formatDistance(result.outbound.distanceKm)} ·{" "}
                          {formatCurrency(result.outbound.totalCost)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/60 px-3 py-2">
                        <p className="font-medium text-foreground mb-1">Volta</p>
                        <p className="text-muted-foreground">
                          {formatDistance(result.return.distanceKm)} ·{" "}
                          {formatCurrency(result.return.totalCost)}
                        </p>
                      </div>
                    </div>
                  )}

                  <Separator className="my-1" />

                  <div className="flex items-center justify-between py-3.5 px-3.5 rounded-lg bg-primary/8 border border-primary/15">
                    <div className="flex items-center gap-2.5">
                      <Wallet className="h-5 w-5 text-primary" />
                      <span className="text-base font-semibold text-primary">
                        Custo total
                      </span>
                    </div>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(result.totalCost)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground/70 text-center mt-3 leading-relaxed">
                  {result.tollLookupFailed
                    ? "Não foi possível consultar as praças de pedágio agora. O valor mostrado desconsidera pedágios."
                    : result.estimatedTollPlazas === 0
                      ? "Nenhuma praça de pedágio encontrada nesta rota (dados do OpenStreetMap)."
                      : result.tollPricesFromOsm
                        ? "Tarifas de pedágio para carro, conforme o OpenStreetMap. Podem estar desatualizadas."
                        : "Praças marcadas com * não têm tarifa no OpenStreetMap; usamos R$ 10,00 como estimativa."}
                </p>
              </Card>
            )}
          </div>

          <div className="lg:col-span-3">
            <Card className="p-0 overflow-hidden card-elegant border-border/60 h-full min-h-[500px]">
              {result?.polyline ? (
                <TripMap
                  polyline={result.polyline}
                  returnPolyline={result.returnPolyline}
                  className="h-full min-h-[500px]"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[500px] bg-muted/30">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                    <MapPin className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold text-muted-foreground mb-1">
                    Mapa da rota
                  </h3>
                  <p className="text-sm text-muted-foreground/70 text-center max-w-xs px-4">
                    Selecione origem e destino e clique em calcular para visualizar a
                    rota no mapa.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>

        {!result && (
          <div className="mt-16 sm:mt-20">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                Tudo que você precisa para planejar sua viagem
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Ferramentas precisas para motoristas brasileiros que querem saber
                exatamente quanto vão gastar na estrada.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-5">
              {[
                {
                  icon: RouteIcon,
                  title: "Distância precisa",
                  desc: "Quilometragem e tempo via OSRM, com rotas reais de estrada.",
                },
                {
                  icon: Fuel,
                  title: "Gasto com combustível",
                  desc: "Informe o consumo do seu carro e o preço do litro para um cálculo exato.",
                },
                {
                  icon: CircleDollarSign,
                  title: "Pedágios reais",
                  desc: "Praças e tarifas do OpenStreetMap, com suporte a ida e volta.",
                },
              ].map((feature, i) => (
                <Card
                  key={i}
                  className="p-6 card-elegant border-border/60 hover:border-primary/30 transition-colors"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-4">
                    <feature.icon className="h-5.5 w-5.5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1.5">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border/40 mt-16">
        <div className="container py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Navigation className="h-4 w-4 text-primary" />
            <span>RoteiroBR — Calculadora de viagem para motoristas brasileiros</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Dados de mapas e pedágios via OpenStreetMap. Valores podem variar.
          </p>
        </div>
      </footer>
    </div>
  );
}
