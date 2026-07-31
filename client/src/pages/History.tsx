import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Navigation,
  History as HistoryIcon,
  Route as RouteIcon,
  Clock,
  Fuel,
  CircleDollarSign,
  Wallet,
  Trash2,
  ArrowRight,
  LogIn,
  Loader2,
  MapPin,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useCallback } from "react";

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

const formatDate = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

export default function HistoryPage() {
  const { user, isAuthenticated, loading } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/",
  });
  const utils = trpc.useUtils();
  const [reusing, setReusing] = useState<number | null>(null);

  const { data: trips, isLoading, error } = trpc.trips.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const deleteMutation = trpc.trips.delete.useMutation({
    onSuccess: () => {
      toast.success("Viagem removida do histórico.");
      utils.trips.list.invalidate();
    },
    onError: () => {
      toast.error("Erro ao remover viagem.");
    },
  });

  const handleDelete = useCallback(
    (tripId: number) => {
      deleteMutation.mutate({ tripId });
    },
    [deleteMutation]
  );

  const handleReuse = useCallback((tripId: number) => {
    setReusing(tripId);
    // Store the trip to reuse in sessionStorage and navigate to home
    const trip = trips?.find((t) => t.id === tripId);
    if (trip) {
      sessionStorage.setItem("reuseTrip", JSON.stringify(trip));
      window.location.href = "/";
    }
  }, [trips]);

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <RouteIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Nova viagem</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container py-8 sm:py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <HistoryIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Histórico de viagens</h1>
              <p className="text-sm text-muted-foreground">
                Suas buscas salvas. Clique em reutilizar para recalcular.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <Card className="p-12 card-elegant border-destructive/30 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mx-auto mb-4">
                <HistoryIcon className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Erro ao carregar histórico</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Ocorreu um erro ao carregar suas viagens. Tente novamente.
              </p>
              <Button onClick={() => utils.trips.list.invalidate()} className="gap-2">
                Tentar novamente
              </Button>
            </Card>
          ) : !trips || trips.length === 0 ? (
            <Card className="p-12 card-elegant border-border/60 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
                <HistoryIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma viagem salva</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Calcule uma viagem e clique em "Salvar" para armazená-la no seu histórico.
              </p>
              <Link href="/">
                <Button className="gap-2">
                  <RouteIcon className="h-4 w-4" />
                  Calcular viagem
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-4">
              {trips.map((trip, index) => (
                <Card
                  key={trip.id}
                  className="p-5 card-elegant border-border/60 hover:border-primary/30 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Route info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs text-muted-foreground font-medium">
                          {formatDate(trip.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm font-medium truncate">{trip.originName}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex items-center gap-1.5">
                          <Navigation className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm font-medium truncate">{trip.destinationName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 sm:border-l sm:border-border/60 sm:pl-5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Distância</span>
                        <span className="text-sm font-semibold flex items-center gap-1">
                          <RouteIcon className="h-3 w-3 text-muted-foreground" />
                          {formatDistance(trip.distanceKm)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Tempo</span>
                        <span className="text-sm font-semibold flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {trip.durationText}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Combustível</span>
                        <span className="text-sm font-semibold flex items-center gap-1">
                          <Fuel className="h-3 w-3 text-muted-foreground" />
                          {formatCurrency(trip.fuelCost)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Total</span>
                        <span className="text-sm font-bold text-primary flex items-center gap-1">
                          <Wallet className="h-3 w-3" />
                          {formatCurrency(trip.totalCost)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:flex-col">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReuse(trip.id)}
                        disabled={reusing === trip.id}
                        className="gap-1.5 flex-1 sm:flex-none"
                      >
                        {reusing === trip.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5" />
                        )}
                        Reutilizar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(trip.id)}
                        disabled={deleteMutation.isPending}
                        className="text-muted-foreground hover:text-destructive gap-1.5 flex-1 sm:flex-none"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {trip.tollCost > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/40">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CircleDollarSign className="h-3.5 w-3.5" />
                        Pedágios: {formatCurrency(trip.tollCost)}
                      </span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
