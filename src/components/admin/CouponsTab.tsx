import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FeatureActivationCard } from "@/components/admin/FeatureActivationCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useFeature } from "@/lib/features";
import { formatDzd } from "@/lib/store";
import { cn } from "@/lib/utils";

type Coupon = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
};

type Draft = {
  id?: string;
  code: string;
  type: "percent" | "fixed";
  value: string;
  min_order: string;
  max_uses: string;
  starts_at: string;
  expires_at: string;
  active: boolean;
  scope: "all" | "selected";
  productIds: string[];
};

type ProductLite = { id: string; name: string; image_url: string | null; image_urls: string[] | null };

const empty: Draft = { code: "", type: "percent", value: "", min_order: "", max_uses: "", starts_at: "", expires_at: "", active: true, scope: "all", productIds: [] };
const db = () => (supabase as any).from("coupons");
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export function CouponsTab() {
  const enabled = useFeature("coupons", false);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: coupons = [] } = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: async () => {
      const { data, error } = await db().select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as Coupon[];
    },
  });
  const { data: links = [] } = useQuery({
    queryKey: ["admin", "coupon_products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("coupon_products").select("coupon_id, product_id");
      if (error) throw new Error(error.message);
      return data as { coupon_id: string; product_id: string }[];
    },
  });
  const { data: products = [] } = useQuery({
    queryKey: ["admin", "coupon_product_options"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("products").select("id, name, image_url, image_urls").order("name");
      if (error) throw new Error(error.message);
      return data as ProductLite[];
    },
  });
  const [search, setSearch] = useState("");
  const productIdsOf = (id: string) => links.filter((l) => l.coupon_id === id).map((l) => l.product_id);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "coupons"] });
    qc.invalidateQueries({ queryKey: ["admin", "coupon_products"] });
  };

  async function save() {
    if (!draft) return;
    const value = Number(draft.value);
    if (!draft.code.trim()) { toast.error("Code requis"); return; }
    if (!(value > 0) || (draft.type === "percent" && value > 100)) { toast.error("Valeur invalide"); return; }
    const payload = {
      code: draft.code.trim().toUpperCase(),
      type: draft.type,
      value,
      min_order: Number(draft.min_order) || 0,
      max_uses: draft.max_uses ? Math.max(1, Math.floor(Number(draft.max_uses))) : null,
      starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
      expires_at: draft.expires_at ? new Date(draft.expires_at).toISOString() : null,
      active: draft.active,
    };
    if (draft.scope === "selected" && draft.productIds.length === 0) { toast.error("Sélectionnez au moins un produit"); return; }
    setSaving(true);
    const res = draft.id ? await db().update(payload).eq("id", draft.id).select("id").single() : await db().insert(payload).select("id").single();
    if (res.error) { setSaving(false); toast.error(res.error.code === "23505" ? "Ce code existe déjà" : res.error.message); return; }
    const couponId = res.data.id as string;
    const cp = (supabase as any).from("coupon_products");
    const del = await cp.delete().eq("coupon_id", couponId);
    let linkErr = del.error;
    if (!linkErr && draft.scope === "selected") {
      const ins = await (supabase as any).from("coupon_products").insert(draft.productIds.map((product_id) => ({ coupon_id: couponId, product_id })));
      linkErr = ins.error;
    }
    setSaving(false);
    if (linkErr) { toast.error(linkErr.message); refresh(); return; }
    toast.success("Code promo enregistré");
    setDraft(null);
    refresh();
  }

  async function toggle(c: Coupon, active: boolean) {
    const { error } = await db().update({ active }).eq("id", c.id);
    if (error) toast.error(error.message);
    refresh();
  }

  async function remove(c: Coupon) {
    if (!confirm(`Supprimer le code ${c.code} ?`)) return;
    const { error } = await db().delete().eq("id", c.id);
    if (error) toast.error(error.message);
    refresh();
  }

  return (
    <div className="grid gap-6">
      <FeatureActivationCard featureKey="coupons" description="Affiche le champ « Code promo » dans le formulaire de commande et le panier." />
      <Card className={cn("rounded-sm", !enabled && "opacity-60")}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Codes ({coupons.length})</CardTitle>
          <Button size="sm" className="rounded-sm" onClick={() => setDraft({ ...empty })}>
            <Plus className="mr-1 size-4" /> Nouveau code
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2">
          {coupons.length === 0 ? <p className="text-sm text-muted-foreground">Aucun code promo.</p> : null}
          {coupons.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-sm border border-border p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-mono font-medium">{c.code}</p>
                <p className="text-xs text-muted-foreground">
                  {c.type === "percent" ? `−${Number(c.value)}%` : `−${formatDzd(Number(c.value))}`}
                  {Number(c.min_order) > 0 ? ` · dès ${formatDzd(Number(c.min_order))}` : ""}
                  {c.expires_at ? ` · expire le ${new Date(c.expires_at).toLocaleDateString("fr-DZ")}` : ""}
                </p>
              </div>
              <span className="rounded-sm bg-muted px-2 py-0.5 text-xs">
                {productIdsOf(c.id).length === 0 ? "Tous les produits" : `${productIdsOf(c.id).length} produit(s)`}
              </span>
              <span className="text-xs text-muted-foreground">
                Utilisé {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}
              </span>
              <Switch checked={c.active} onCheckedChange={(v) => void toggle(c, v)} aria-label="Actif" />
              <Button size="icon" variant="ghost" onClick={() => setDraft({
                id: c.id, code: c.code, type: c.type, value: String(c.value), min_order: Number(c.min_order) ? String(c.min_order) : "",
                max_uses: c.max_uses ? String(c.max_uses) : "", starts_at: toLocal(c.starts_at), expires_at: toLocal(c.expires_at), active: c.active,
                scope: productIdsOf(c.id).length ? "selected" : "all", productIds: productIdsOf(c.id),
              })} aria-label="Modifier"><Pencil className="size-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => void remove(c)} aria-label="Supprimer"><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft?.id ? "Modifier le code" : "Nouveau code promo"}</DialogTitle></DialogHeader>
          {draft ? (
            <div className="grid gap-3">
              <div className="grid gap-1"><Label>Code</Label>
                <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} className="font-mono uppercase" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1"><Label>Type</Label>
                  <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as Draft["type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="percent">Pourcentage (%)</SelectItem><SelectItem value="fixed">Montant fixe (DA)</SelectItem></SelectContent>
                  </Select></div>
                <div className="grid gap-1"><Label>Valeur</Label>
                  <Input type="number" min={0} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /></div>
                <div className="grid gap-1"><Label>Commande minimum (DA)</Label>
                  <Input type="number" min={0} value={draft.min_order} onChange={(e) => setDraft({ ...draft, min_order: e.target.value })} /></div>
                <div className="grid gap-1"><Label>Utilisations max</Label>
                  <Input type="number" min={1} placeholder="Illimité" value={draft.max_uses} onChange={(e) => setDraft({ ...draft, max_uses: e.target.value })} /></div>
                <div className="grid gap-1"><Label>Début</Label>
                  <Input type="datetime-local" value={draft.starts_at} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} /></div>
                <div className="grid gap-1"><Label>Expiration</Label>
                  <Input type="datetime-local" value={draft.expires_at} onChange={(e) => setDraft({ ...draft, expires_at: e.target.value })} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} /> Actif</label>
              <div className="grid gap-2 border-t border-border pt-3">
                <Label>Produits concernés</Label>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="radio" checked={draft.scope === "all"} onChange={() => setDraft({ ...draft, scope: "all" })} /> Tous les produits</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={draft.scope === "selected"} onChange={() => setDraft({ ...draft, scope: "selected" })} /> Produits sélectionnés</label>
                </div>
                {draft.scope === "selected" ? (() => {
                  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
                  const toggleP = (id: string) => setDraft({ ...draft, productIds: draft.productIds.includes(id) ? draft.productIds.filter((x) => x !== id) : [...draft.productIds, id] });
                  return (
                    <div className="grid gap-2">
                      {draft.productIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {draft.productIds.map((id) => (
                            <span key={id} className="flex items-center gap-1 rounded-sm bg-accent px-2 py-0.5 text-xs">
                              {products.find((p) => p.id === id)?.name ?? "—"}
                              <button type="button" onClick={() => toggleP(id)} aria-label="Retirer"><X className="size-3" /></button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex gap-2">
                        <Input placeholder="Rechercher un produit…" value={search} onChange={(e) => setSearch(e.target.value)} />
                        <Button type="button" variant="outline" size="sm" onClick={() => setDraft({ ...draft, productIds: Array.from(new Set([...draft.productIds, ...filtered.map((p) => p.id)])) })}>Tout sélectionner</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, productIds: [] })}>Effacer</Button>
                      </div>
                      <div className="grid max-h-56 gap-1 overflow-y-auto rounded-sm border border-border p-1">
                        {filtered.map((p) => {
                          const img = p.image_urls?.[0] ?? p.image_url;
                          return (
                            <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-sm p-1 text-sm hover:bg-muted">
                              <input type="checkbox" checked={draft.productIds.includes(p.id)} onChange={() => toggleP(p.id)} />
                              {img ? <img src={img} alt="" className="size-8 rounded-sm object-cover" /> : <span className="size-8 rounded-sm bg-muted" />}
                              <span className="truncate">{p.name}</span>
                            </label>
                          );
                        })}
                        {filtered.length === 0 ? <p className="p-2 text-xs text-muted-foreground">Aucun produit.</p> : null}
                      </div>
                    </div>
                  );
                })() : null}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Annuler</Button>
            <Button onClick={() => void save()} disabled={saving}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
