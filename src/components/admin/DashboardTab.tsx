import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { FeatureActivationCard } from "@/components/admin/FeatureActivationCard";
import { saveFeatureConfig } from "@/components/admin/feature-admin";
import {
  OrderDateFilter,
  resolveDateBounds,
  type DateFilterValue,
  type DatePreset,
} from "@/components/admin/OrderDateFilter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useFeature, useFeatureConfig } from "@/lib/features";
import { formatDzd } from "@/lib/store";
import { cn } from "@/lib/utils";

const FEATURE_KEY = "dashboard";
const DASHBOARD_PRESETS: readonly DatePreset[] = ["today", "7d", "30d", "month", "custom"];
const DEFAULT_RANGE = "30d";

export const KPI_DEFS = [
  { key: "orders", label: "Commandes" },
  { key: "revenue", label: "Chiffre d'affaires" },
  { key: "avg_basket", label: "Panier moyen" },
  { key: "confirmation_rate", label: "Taux de confirmation" },
  { key: "delivery_rate", label: "Taux de livraison" },
  { key: "cancelled", label: "Annulées" },
] as const;
type KpiKey = (typeof KPI_DEFS)[number]["key"];
const ALL_KPIS = KPI_DEFS.map((k) => k.key) as KpiKey[];

type DashboardConfig = { kpis?: string[] };

type Stats = {
  kpis: {
    orders_count: number;
    valid_count: number;
    revenue: number;
    confirmed_count: number;
    delivered_count: number;
    cancelled_count: number;
  };
  daily: { day: string; orders: number; revenue: number }[];
  top_products: { name: string; qty: number; amount: number }[];
  top_wilayas: { name: string; orders: number; amount: number }[];
};

const chartConfig = {
  revenue: { label: "Chiffre d'affaires", color: "var(--chart-1)" },
  orders: { label: "Commandes", color: "var(--chart-2)" },
} satisfies ChartConfig;

const adminRoute = getRouteApi("/admin");

function pct(part: number, whole: number) {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 1000) / 10} %`;
}

export function DashboardTab() {
  const enabled = useFeature(FEATURE_KEY, false);
  const config = useFeatureConfig<DashboardConfig>(FEATURE_KEY);
  const visibleKpis = (
    Array.isArray(config?.kpis) ? config.kpis.filter((k): k is KpiKey => ALL_KPIS.includes(k as KpiKey)) : ALL_KPIS
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureActivationCard
          featureKey={FEATURE_KEY}
          description="Affiche le tableau de bord comme page d'accueil de l'administration."
        />
        <KpiSettingsCard enabled={enabled} visible={visibleKpis} />
      </div>
      {enabled ? <DashboardContent visibleKpis={visibleKpis} /> : null}
    </div>
  );
}

function KpiSettingsCard({ enabled, visible }: { enabled: boolean; visible: KpiKey[] }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function toggle(key: KpiKey, checked: boolean) {
    const next = ALL_KPIS.filter((k) => (k === key ? checked : visible.includes(k)));
    setBusy(true);
    try {
      await saveFeatureConfig(queryClient, FEATURE_KEY, { kpis: next });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de l'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn("rounded-sm transition-opacity", !enabled && "pointer-events-none opacity-50")}>
      <CardHeader>
        <CardTitle className="text-base">Indicateurs visibles</CardTitle>
        <CardDescription>Choisissez les cartes affichées en haut du tableau de bord.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {KPI_DEFS.map((kpi) => (
          <label key={kpi.key} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={visible.includes(kpi.key)}
              disabled={!enabled || busy}
              onCheckedChange={(v) => void toggle(kpi.key, v === true)}
            />
            {kpi.label}
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

function DashboardContent({ visibleKpis }: { visibleKpis: KpiKey[] }) {
  const { range, from, to } = adminRoute.useSearch();
  const navigate = adminRoute.useNavigate();
  const value: DateFilterValue = { range: range ?? DEFAULT_RANGE, from, to };
  const bounds = resolveDateBounds(value) ?? resolveDateBounds({ range: DEFAULT_RANGE })!;
  const startIso = bounds.start.toISOString();
  const endIso = bounds.end.toISOString();

  function changeRange(next: DateFilterValue) {
    void navigate({
      search: (prev) => ({ ...prev, range: next.range, from: next.from, to: next.to }),
      replace: true,
    });
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "dashboard", startIso, endIso],
    queryFn: async () => {
      const { data: stats, error: rpcError } = await (supabase as any).rpc("admin_dashboard_stats", {
        _start: startIso,
        _end: endIso,
        _tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (rpcError) throw new Error(rpcError.message);
      return stats as Stats;
    },
  });

  const k = data?.kpis;
  const cards: Record<KpiKey, { value: string; hint: string }> = {
    orders: { value: k ? String(k.orders_count) : "—", hint: "Toutes les commandes de la période" },
    revenue: { value: k ? formatDzd(Number(k.revenue)) : "—", hint: "Hors annulées, livraison incluse" },
    avg_basket: {
      value: k && k.valid_count ? formatDzd(Math.round(Number(k.revenue) / k.valid_count)) : "—",
      hint: "Chiffre d'affaires ÷ commandes non annulées",
    },
    confirmation_rate: {
      value: k ? pct(k.confirmed_count, k.orders_count) : "—",
      hint: "Confirmées, expédiées ou livrées ÷ total",
    },
    delivery_rate: {
      value: k ? pct(k.delivered_count, k.confirmed_count) : "—",
      hint: "Livrées ÷ commandes confirmées",
    },
    cancelled: { value: k ? String(k.cancelled_count) : "—", hint: "Commandes annulées" },
  };

  const chartData = (data?.daily ?? []).map((d) => ({
    label: format(parseISO(d.day), "d MMM", { locale: fr }),
    revenue: Number(d.revenue),
    orders: Number(d.orders),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <OrderDateFilter
          value={value}
          onChange={changeRange}
          presets={DASHBOARD_PRESETS}
          allowAll={false}
        />
        {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      ) : null}

      {visibleKpis.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {KPI_DEFS.filter((kpi) => visibleKpis.includes(kpi.key)).map((kpi) => (
            <Card key={kpi.key} className="rounded-sm">
              <CardContent className="space-y-1 p-4">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="font-display text-2xl tabular-nums text-foreground">
                  {cards[kpi.key].value}
                </p>
                <p className="text-[11px] leading-snug text-muted-foreground">{cards[kpi.key].hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="rounded-sm">
        <CardHeader>
          <CardTitle className="text-base">Chiffre d'affaires et commandes par jour</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
            <ComposedChart data={chartData} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis
                yAxisId="revenue"
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={32}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(val, name) => (
                      <div className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">
                          {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                        </span>
                        <span className="font-mono tabular-nums">
                          {name === "revenue" ? formatDzd(Number(val)) : String(val)}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar yAxisId="revenue" dataKey="revenue" fill="var(--color-revenue)" radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="orders"
                dataKey="orders"
                type="monotone"
                stroke="var(--color-orders)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopList
          title="Top 5 produits"
          empty="Aucune vente sur cette période."
          rows={(data?.top_products ?? []).map((p) => ({
            name: p.name,
            main: `${p.qty} pièce${p.qty > 1 ? "s" : ""}`,
            sub: formatDzd(Number(p.amount)),
          }))}
        />
        <TopList
          title="Top 5 wilayas"
          empty="Aucune commande sur cette période."
          rows={(data?.top_wilayas ?? []).map((w) => ({
            name: w.name,
            main: `${w.orders} commande${w.orders > 1 ? "s" : ""}`,
            sub: formatDzd(Number(w.amount)),
          }))}
        />
      </div>
    </div>
  );
}

function TopList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { name: string; main: string; sub: string }[];
}) {
  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ol className="divide-y divide-border">
            {rows.map((row, i) => (
              <li key={`${row.name}-${i}`} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-5 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">{row.name}</span>
                <span className="text-right tabular-nums">
                  <span className="block text-foreground">{row.main}</span>
                  <span className="block text-xs text-muted-foreground">{row.sub}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
