import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CityAutocomplete, type CitySelection } from "@/components/CityAutocomplete";
import { TripMap } from "@/components/TripMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  MapPin,
  Navigation,
  Fuel,
  DollarSign,
  Clock,
  Route as RouteIcon,
  Loader2,
  ArrowRight,
  LogIn,
  LogOut,
  History,
  CircleDollarSign,
  Wallet,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";

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
  const { user, isAuthenticated, logout } = useAuth();
  const [origin, setOrigin] = useState<CitySelection | null>(null);
  const [destination, setDestination] = useState<CitySelection | null>(null);
  const [fuelConsumption, setFuelConsumption] = useState("10");
  const [fuelPrice, setFuelPrice] = useState("5.89");

  // Check for a reuse trip from history page
  useEffect(() => {
    const reuseData = sessionStorage.getItem("reuseTrip");
    if (reuseData) {
      try {
        const trip = JSON.parse(reuseData);
        setOrigin({ placeId: trip.originPlaceId, description: trip.originName, mainText: trip.originName });
        setDestination({ placeId: trip.destinationPlaceId, description: trip.destinationName, mainText: trip.destinationName });
        setFuelConsumption(String(trip.fuelConsumption));
        setFuelPrice(String(trip.fuelPrice));
        // Auto-calculate after a brief delay to ensure state is set
        setTimeout(() => {
          calculateMutation.mutate({
            originPlaceId: trip.originPlaceId,
            destinationPlaceId: trip.destinationPlaceId,
            fuelConsumption: trip.fuelConsumption,
            fuelPrice: trip.fuelPrice,
          });
        }, 100);
      } catch (e) {
        console.error("Failed to parse reuse trip:", e);
      }
      sessionStorage.removeItem("reuseTrip");
    }
  }, []);

  const calculateMutation = trpc.trips.calculate.useMutation({
    onError: (err) => {
      toast.error(err.message || "Erro ao calcular rota. Tente novamente.");
    },
  });

  const saveTripMutation = trpc.trips.save.useMutation({
    onSuccess: () => {
      toast.success("Viagem salva no seu histórico!");
    },
    onError: () => {
      toast.error("Erro ao salvar viagem no histórico.");
    },
  });

  const result = calculateMutation.data;

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
      fuelConsumption: consumption,
      fuelPrice: price,
    });
  }, [origin, destination, fuelConsumption, fuelPrice, calculateMutation]);

  const handleSaveTrip = useCallback(() => {
    if (!result || !origin || !destination || !isAuthenticated) return;
    saveTripMutation.mutate({
      originName: origin.description,
      originPlaceId: origin.placeId,
      destinationName: destination.description,
      destinationPlaceId: destination.placeId,
      distanceKm: result.distanceKm,
      durationText: result.durationText,
      durationSeconds: result.durationSeconds,
      fuelConsumption: parseFloat(fuelConsumption),
      fuelPrice: parseFloat(fuelPrice),
      fuelCost: result.fuelCost,
      tollCost: result.tollCost,
      totalCost: result.totalCost,
      polyline: result.polyline,
    });
  }, [result, origin, destination, isAuthenticated, fuelConsumption, fuelPrice, saveTripMutation]);

  const canCalculate = origin && destination && fuelConsumption && fuelPrice;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
              <Navigation className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Roteiro<span className="text-primary">BR</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">
                Calculadora de Viagem
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link href="/historico">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <History className="h-4 w-4" />
                    <span className="hidden sm:inline">Histórico</span>
                  </Button>
                </Link>
                <div className="flex items-center gap-2.5 pl-2 border-l border-border/60">
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                    {user?.name || user?.email}
                  </span>
                  <Button variant="outline" size="sm" onClick={logout} className="gap-2">
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Sair</span>
                  </Button>
                </div>
              </>
            ) : (
              <Button size="sm" onClick={() => import("@/const").then(m => m.startLogin())} className="gap-2">
                <LogIn className="h-4 w-4" />
                Entrar
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
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
              entre qualquer cidade do Brasil. Tudo em um só lugar.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container py-8 sm:py-12">
        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Left: Form */}
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
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted border-2 border-background shadow-sm">
                    <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                  </div>
                </div>

                <CityAutocomplete
                  label="Destino"
                  placeholder="Digite a cidade de destino..."
                  value={destination}
                  onChange={setDestination}
                  icon={<Navigation className="h-4 w-4 text-primary" />}
                />

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
                      Calcular Viagem
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {result && (
              <Card className="p-6 card-elegant border-border/60 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Resumo da viagem</h2>
                  </div>
                  {isAuthenticated && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveTrip}
                      disabled={saveTripMutation.isPending}
                      className="gap-1.5"
                    >
                      {saveTripMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <History className="h-3.5 w-3.5" />
                      )}
                      Salvar
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2.5 px-3.5 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2.5">
                      <RouteIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Distância</span>
                    </div>
                    <span className="text-sm font-semibold">{formatDistance(result.distanceKm)}</span>
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
                    <span className="text-sm font-semibold">{formatCurrency(result.fuelCost)}</span>
                  </div>

                  <div className="flex items-center justify-between py-2.5 px-3.5 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2.5">
                      <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Pedágios {result.estimatedTollPlazas > 0 && `(${result.estimatedTollPlazas} praças)`} *
                      </span>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(result.tollCost)}</span>
                  </div>

                  <Separator className="my-1" />

                  <div className="flex items-center justify-between py-3.5 px-3.5 rounded-lg bg-primary/8 border border-primary/15">
                    <div className="flex items-center gap-2.5">
                      <Wallet className="h-5 w-5 text-primary" />
                      <span className="text-base font-semibold text-primary">Custo total</span>
                    </div>
                    <span className="text-xl font-bold text-primary">{formatCurrency(result.totalCost)}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground/70 text-center mt-3 leading-relaxed">
                  * Estimativa de pedágios baseada em média de R$ 10,00 a cada 50 km. O valor real pode variar conforme a rodovia.
                </p>
                {!isAuthenticated && (
                  <p className="text-xs text-muted-foreground text-center mt-2 leading-relaxed">
                    <button
                      onClick={() => import("@/const").then(m => m.startLogin())}
                      className="text-primary font-medium hover:underline"
                    >
                      Faça login
                    </button>
                    {" "}para salvar suas viagens no histórico
                  </p>
                )}
              </Card>
            )}
          </div>

          {/* Right: Map */}
          <div className="lg:col-span-3">
            <Card className="p-0 overflow-hidden card-elegant border-border/60 h-full min-h-[500px]">
              {result?.polyline ? (
                <TripMap polyline={result.polyline} className="h-full min-h-[500px]" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[500px] bg-muted/30">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                    <MapPin className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold text-muted-foreground mb-1">
                    Mapa da rota
                  </h3>
                  <p className="text-sm text-muted-foreground/70 text-center max-w-xs px-4">
                    Selecione origem e destino e clique em "Calcular Viagem" para visualizar a rota no mapa.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Features section */}
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
                  desc: "Cálculo exato da quilometragem entre cidades usando o Google Maps.",
                },
                {
                  icon: Fuel,
                  title: "Gasto com combustível",
                  desc: "Informe o consumo do seu carro e o preço do litro para um cálculo exato.",
                },
                {
                  icon: CircleDollarSign,
                  title: "Estimativa de pedágios",
                  desc: "Saiba quanto vai gastar em pedágios antes de pegar a estrada.",
                },
              ].map((feature, i) => (
                <Card key={i} className="p-6 card-elegant border-border/60 hover:border-primary/30 transition-colors">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-4">
                    <feature.icon className="h-5.5 w-5.5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1.5">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-16">
        <div className="container py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Navigation className="h-4 w-4 text-primary" />
            <span>RoteiroBR — Calculadora de viagem para motoristas brasileiros</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Estimativas de pedágios são aproximadas. Valores reais podem variar.
          </p>
        </div>
      </footer>
    </div>
  );
}
