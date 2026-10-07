import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FeatureActivationCard } from "@/components/admin/FeatureActivationCard";
import { saveFeatureConfig } from "@/components/admin/feature-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useFeature, useFeatureConfig } from "@/lib/features";
import { communesQuery, formatDzd } from "@/lib/store";
import { cn } from "@/lib/utils";

type Rate = {
  wilaya_code: number;
  wilaya_name: string;
  domicile_fee: number;
  stopdesk_fee: number;
  active: boolean;
};

type Desk = {
  id: number;
  wilaya_code: number;
  wilaya_name: string;
  commune_name: string;
  desk_name: string;
  desk_code: string | null;
  address: string;
  active: boolean;
};

const db = supabase as any;
const pad = (n: number) => String(n).padStart(2, "0");

function useRefreshDelivery() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "shipping_rates"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "stopdesks"] });
    void queryClient.invalidateQueries({ queryKey: ["shipping_rates"] });
    void queryClient.invalidateQueries({ queryKey: ["stopdesks"] });
  };
}

function useAdminRates() {
  return useQuery({
    queryKey: ["admin", "shipping_rates"],
    queryFn: async () => {
      const { data, error } = await db.from("shipping_rates").select("*").order("wilaya_code");
      if (error) throw new Error(error.message);
      return (data ?? []) as Rate[];
    },
  });
}

export function DeliveryTab() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureActivationCard
          featureKey="free_shipping"
          description="Offre la livraison au-delà d'un montant de commande."
        />
        <FreeShippingSettings />
      </div>
      <RatesSection />
      <StopdesksSection />
    </div>
  );
}

function FreeShippingSettings() {
  const queryClient = useQueryClient();
  const enabled = useFeature("free_shipping", false);
  const config = useFeatureConfig<{ threshold?: unknown }>("free_shipping");
  const stored = Number(config?.threshold);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAmount(Number.isFinite(stored) && stored > 0 ? String(stored) : "");
  }, [stored]);

  async function save() {
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      toast.error("Indiquez un montant entier supérieur à 0");
      return;
    }
    setBusy(true);
    try {
      await saveFeatureConfig(queryClient, "free_shipping", { threshold: value });
      toast.success("Seuil enregistré");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de l'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn("rounded-sm transition-opacity", !enabled && "pointer-events-none opacity-50")}>
      <CardHeader>
        <CardTitle className="text-base">Livraison gratuite</CardTitle>
        <CardDescription>
          Livraison offerte quand le sous-total des articles atteint ce montant.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="free-shipping-amount">À partir de (DA)</Label>
          <Input
            id="free-shipping-amount"
            type="number"
            min={1}
            step={100}
            value={amount}
            disabled={!enabled}
            onChange={(event) => setAmount(event.target.value)}
            className="h-10 w-40 rounded-sm"
          />
        </div>
        <Button type="button" className="rounded-sm" disabled={!enabled || busy} onClick={save}>
          Enregistrer
        </Button>
        {!enabled ? null : stored > 0 ? (
          <p className="w-full text-xs text-muted-foreground">
            Actuellement : gratuite dès {formatDzd(stored)}
          </p>
        ) : (
          <p className="w-full text-xs text-muted-foreground">Aucun seuil défini pour l'instant.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PriceInput({
  value,
  label,
  onSave,
}: {
  value: number;
  label: string;
  onSave: (next: number) => void;
}) {
  return (
    <Input
      key={value}
      type="number"
      min={0}
      step={50}
      defaultValue={value}
      aria-label={label}
      className="h-9 w-28 rounded-sm tabular-nums"
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
      onBlur={(event) => {
        const next = Number(event.target.value);
        if (!Number.isInteger(next) || next < 0) {
          toast.error("Prix invalide");
          event.target.value = String(value);
          return;
        }
        if (next !== value) onSave(next);
      }}
    />
  );
}

function RatesSection() {
  const refresh = useRefreshDelivery();
  const { data: rates = [], isLoading } = useAdminRates();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkField, setBulkField] = useState<"both" | "domicile" | "stopdesk">("both");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const visible = rates.filter((rate) => {
    const term = search.trim().toLowerCase();
    return !term || `${pad(rate.wilaya_code)} ${rate.wilaya_name}`.toLowerCase().includes(term);
  });
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.wilaya_code));
  const activeCount = rates.filter((r) => r.active).length;

  async function update(code: number, patch: Partial<Rate>) {
    const { error } = await db.from("shipping_rates").update(patch).eq("wilaya_code", code);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Enregistré");
    refresh();
  }

  async function applyBulk() {
    const price = Number(bulkPrice);
    if (!Number.isInteger(price) || price < 0) {
      toast.error("Prix invalide");
      return;
    }
    const patch =
      bulkField === "both"
        ? { domicile_fee: price, stopdesk_fee: price }
        : bulkField === "domicile"
          ? { domicile_fee: price }
          : { stopdesk_fee: price };
    setBulkBusy(true);
    const ids = Array.from(selected);
    const { error } = await db.from("shipping_rates").update(patch).in("wilaya_code", ids);
    setBulkBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Prix appliqué à ${ids.length} wilaya(s)`);
    setSelected(new Set());
    setBulkPrice("");
    refresh();
  }

  function toggle(code: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-base">Tarifs par wilaya</CardTitle>
        <CardDescription>
          {activeCount} wilaya(s) desservie(s) sur {rates.length}. Les wilayas désactivées
          n'apparaissent plus dans le formulaire de commande.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher une wilaya"
          className="h-10 rounded-sm sm:max-w-xs"
        />

        {selected.size > 0 ? (
          <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-sm border border-border bg-card p-3 shadow-sm">
            <span className="text-sm font-medium">{selected.size} sélectionnée(s)</span>
            <Select value={bulkField} onValueChange={(v) => setBulkField(v as typeof bulkField)}>
              <SelectTrigger className="h-9 w-44 rounded-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Domicile et Stopdesk</SelectItem>
                <SelectItem value="domicile">Domicile</SelectItem>
                <SelectItem value="stopdesk">Stopdesk</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              step={50}
              value={bulkPrice}
              onChange={(event) => setBulkPrice(event.target.value)}
              placeholder="Prix (DA)"
              className="h-9 w-32 rounded-sm"
            />
            <Button
              type="button"
              size="sm"
              className="rounded-sm"
              disabled={bulkBusy || bulkPrice === ""}
              onClick={applyBulk}
            >
              Appliquer un prix à la sélection
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-sm"
              onClick={() => setSelected(new Set())}
            >
              Tout désélectionner
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 p-3">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={() =>
                        setSelected(
                          allVisibleSelected ? new Set() : new Set(visible.map((r) => r.wilaya_code)),
                        )
                      }
                      aria-label="Tout sélectionner"
                    />
                  </th>
                  <th className="p-3 font-medium">Wilaya</th>
                  <th className="p-3 font-medium">À domicile (DA)</th>
                  <th className="p-3 font-medium">Stopdesk (DA)</th>
                  <th className="p-3 font-medium">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((rate) => (
                  <tr key={rate.wilaya_code} className={cn(!rate.active && "bg-muted/30")}>
                    <td className="p-3">
                      <Checkbox
                        checked={selected.has(rate.wilaya_code)}
                        onCheckedChange={() => toggle(rate.wilaya_code)}
                        aria-label={`Sélectionner ${rate.wilaya_name}`}
                      />
                    </td>
                    <td className={cn("p-3", !rate.active && "text-muted-foreground")}>
                      <span className="me-2 tabular-nums text-muted-foreground">
                        {pad(rate.wilaya_code)}
                      </span>
                      {rate.wilaya_name}
                    </td>
                    <td className="p-2">
                      <PriceInput
                        value={rate.domicile_fee}
                        label={`Prix à domicile ${rate.wilaya_name}`}
                        onSave={(v) => void update(rate.wilaya_code, { domicile_fee: v })}
                      />
                    </td>
                    <td className="p-2">
                      <PriceInput
                        value={rate.stopdesk_fee}
                        label={`Prix stopdesk ${rate.wilaya_name}`}
                        onSave={(v) => void update(rate.wilaya_code, { stopdesk_fee: v })}
                      />
                    </td>
                    <td className="p-3">
                      <Switch
                        checked={rate.active}
                        onCheckedChange={(v) => void update(rate.wilaya_code, { active: v })}
                        aria-label={`Activer ${rate.wilaya_name}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type DeskForm = {
  id: number | null;
  wilaya_code: string;
  commune_name: string;
  desk_name: string;
  desk_code: string;
  address: string;
};

const emptyDesk = (wilaya = ""): DeskForm => ({
  id: null,
  wilaya_code: wilaya,
  commune_name: "",
  desk_name: "",
  desk_code: "",
  address: "",
});

function StopdesksSection() {
  const refresh = useRefreshDelivery();
  const { data: rates = [] } = useAdminRates();
  const { data: desks = [], isLoading } = useQuery({
    queryKey: ["admin", "stopdesks"],
    queryFn: async () => {
      const { data, error } = await db
        .from("stopdesks")
        .select("*")
        .order("wilaya_code")
        .order("commune_name");
      if (error) throw new Error(error.message);
      return (data ?? []) as Desk[];
    },
  });
  const [wilayaFilter, setWilayaFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<DeskForm | null>(null);
  const [saving, setSaving] = useState(false);

  const formCode = form?.wilaya_code ? Number(form.wilaya_code) : null;
  const { data: communes = [] } = useQuery(communesQuery(formCode));

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return desks.filter(
      (desk) =>
        (wilayaFilter === "all" || desk.wilaya_code === Number(wilayaFilter)) &&
        (!term ||
          [desk.desk_name, desk.desk_code ?? "", desk.commune_name, desk.address, desk.wilaya_name]
            .join(" ")
            .toLowerCase()
            .includes(term)),
    );
  }, [desks, wilayaFilter, search]);

  async function setActive(desk: Desk, active: boolean) {
    const { error } = await db.from("stopdesks").update({ active }).eq("id", desk.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(active ? "Bureau activé" : "Bureau désactivé");
    refresh();
  }

  async function saveDesk() {
    if (!form) return;
    const rate = rates.find((r) => r.wilaya_code === Number(form.wilaya_code));
    if (!rate) return toast.error("Choisissez une wilaya");
    if (!form.commune_name.trim()) return toast.error("Commune requise");
    if (!form.desk_name.trim()) return toast.error("Nom du bureau requis");
    if (!form.address.trim()) return toast.error("Adresse requise");
    const code = form.desk_code.trim();
    if (code && desks.some((d) => d.desk_code === code && d.id !== form.id)) {
      return toast.error("Ce code est déjà utilisé par un autre bureau");
    }
    const payload = {
      wilaya_code: rate.wilaya_code,
      wilaya_name: rate.wilaya_name,
      commune_name: form.commune_name.trim(),
      desk_name: form.desk_name.trim(),
      desk_code: code || null,
      address: form.address.trim(),
    };
    setSaving(true);
    const { error } = form.id
      ? await db.from("stopdesks").update(payload).eq("id", form.id)
      : await db.from("stopdesks").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Bureau modifié" : "Bureau ajouté");
    setForm(null);
    refresh();
  }

  return (
    <Card className="rounded-sm">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Bureaux Stopdesk</CardTitle>
          <CardDescription>
            Les bureaux désactivés ne sont plus proposés aux clients.
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          className="rounded-sm"
          onClick={() => setForm(emptyDesk(wilayaFilter === "all" ? "" : wilayaFilter))}
        >
          <Plus className="me-1 size-4" /> Ajouter un bureau
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={wilayaFilter} onValueChange={setWilayaFilter}>
            <SelectTrigger className="h-10 rounded-sm sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les wilayas</SelectItem>
              {rates.map((rate) => (
                <SelectItem key={rate.wilaya_code} value={String(rate.wilaya_code)}>
                  {pad(rate.wilaya_code)} — {rate.wilaya_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher (bureau, code, commune, adresse)"
            className="h-10 rounded-sm sm:max-w-sm"
          />
        </div>

        <p className="text-xs text-muted-foreground">{visible.length} bureau(x)</p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun bureau.</p>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Bureau</th>
                  <th className="p-3 font-medium">Wilaya / Commune</th>
                  <th className="p-3 font-medium">Adresse</th>
                  <th className="p-3 font-medium">Actif</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((desk) => (
                  <tr key={desk.id} className={cn(!desk.active && "bg-muted/30 text-muted-foreground")}>
                    <td className="p-3">
                      <p className="font-medium">{desk.desk_name}</p>
                      <p className="text-xs text-muted-foreground">{desk.desk_code || "Sans code"}</p>
                    </td>
                    <td className="p-3">
                      <p>{pad(desk.wilaya_code)} — {desk.wilaya_name}</p>
                      <p className="text-xs text-muted-foreground">{desk.commune_name}</p>
                    </td>
                    <td className="max-w-72 p-3 text-xs">{desk.address}</td>
                    <td className="p-3">
                      <Switch
                        checked={desk.active}
                        onCheckedChange={(v) => void setActive(desk, v)}
                        aria-label={`Activer ${desk.desk_name}`}
                      />
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-sm"
                        onClick={() =>
                          setForm({
                            id: desk.id,
                            wilaya_code: String(desk.wilaya_code),
                            commune_name: desk.commune_name,
                            desk_name: desk.desk_name,
                            desk_code: desk.desk_code ?? "",
                            address: desk.address,
                          })
                        }
                      >
                        <Pencil className="me-1 size-3.5" /> Modifier
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="rounded-sm sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Modifier le bureau" : "Ajouter un bureau"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Wilaya *</Label>
                <Select
                  value={form.wilaya_code}
                  onValueChange={(v) => setForm({ ...form, wilaya_code: v, commune_name: "" })}
                >
                  <SelectTrigger className="h-10 rounded-sm">
                    <SelectValue placeholder="Choisir une wilaya" />
                  </SelectTrigger>
                  <SelectContent>
                    {rates.map((rate) => (
                      <SelectItem key={rate.wilaya_code} value={String(rate.wilaya_code)}>
                        {pad(rate.wilaya_code)} — {rate.wilaya_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desk-commune">Commune *</Label>
                <Input
                  id="desk-commune"
                  list="desk-commune-options"
                  value={form.commune_name}
                  onChange={(event) => setForm({ ...form, commune_name: event.target.value })}
                  disabled={!form.wilaya_code}
                  className="h-10 rounded-sm"
                />
                <datalist id="desk-commune-options">
                  {communes.map((c) => (
                    <option key={c.commune_name} value={c.commune_name} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="desk-name">Nom du bureau *</Label>
                  <Input
                    id="desk-name"
                    value={form.desk_name}
                    onChange={(event) => setForm({ ...form, desk_name: event.target.value })}
                    className="h-10 rounded-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="desk-code">Code du bureau</Label>
                  <Input
                    id="desk-code"
                    value={form.desk_code}
                    onChange={(event) => setForm({ ...form, desk_code: event.target.value })}
                    className="h-10 rounded-sm"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desk-address">Adresse *</Label>
                <Input
                  id="desk-address"
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                  className="h-10 rounded-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Le code est envoyé au Google Sheet à la place du nom du bureau.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-sm" onClick={() => setForm(null)}>
              Annuler
            </Button>
            <Button type="button" className="rounded-sm" disabled={saving} onClick={saveDesk}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
