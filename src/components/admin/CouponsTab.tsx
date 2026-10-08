import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
};

const empty: Draft = { code: "", type: "percent", value: "", min_order: "", max_uses: "", starts_at: "", expires_at: "", active: true };
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
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "coupons"] });

  async function save() {
    if (!draft) return;
    const value = Number(draft.value);
    if (!draft.code.trim()) return toast.error("Code requis");
    if (!(value > 0) || (draft.type === "percent" && value > 100)) return toast.error("Valeur invalide");
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
    setSaving(true);
    const { error } = draft.id ? await db().update(payload).eq("id", draft.id) : await db().insert(payload);
    setSaving(false);
    if (error) return toast.error(error.code === "23505" ? "Ce code existe déjà" : error.message);
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
              <span className="text-xs text-muted-foreground">
                Utilisé {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}
              </span>
              <Switch checked={c.active} onCheckedChange={(v) => void toggle(c, v)} aria-label="Actif" />
              <Button size="icon" variant="ghost" onClick={() => setDraft({
                id: c.id, code: c.code, type: c.type, value: String(c.value), min_order: Number(c.min_order) ? String(c.min_order) : "",
                max_uses: c.max_uses ? String(c.max_uses) : "", starts_at: toLocal(c.starts_at), expires_at: toLocal(c.expires_at), active: c.active,
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
