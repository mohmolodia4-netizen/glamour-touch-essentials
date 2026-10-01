import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { crossSellQuery, productsQuery } from "@/lib/store";

/** Admin picker for the "Complétez votre look" list. Changes save immediately. */
export function CrossSellPicker() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: products = [] } = useQuery(productsQuery());
  const { data: rows = [] } = useQuery(crossSellQuery());

  const byId = new Map(products.map((p) => [p.id, p]));
  const selectedIds = new Set(rows.map((r) => r.product_id));
  const q = search.trim().toLowerCase();
  const results = q
    ? products.filter((p) => !selectedIds.has(p.id) && p.name.toLowerCase().includes(q)).slice(0, 8)
    : [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["cross_sell"] });
  const run = async (fn: () => Promise<{ error: unknown }[]>) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.some((r) => r.error)) toast.error("Échec de l'enregistrement");
    await refresh();
  };

  const add = (id: string) =>
    run(async () => {
      setSearch("");
      const max = rows.reduce((m, r) => Math.max(m, r.sort_order), -1);
      return [await supabase.from("cross_sell_products").insert({ product_id: id, sort_order: max + 1 })];
    });
  const remove = (id: string) =>
    run(async () => [await supabase.from("cross_sell_products").delete().eq("id", id)]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const order = [...rows];
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
    return run(() =>
      Promise.all(
        order.map((r, idx) =>
          supabase.from("cross_sell_products").update({ sort_order: idx }).eq("id", r.id),
        ),
      ),
    );
  };

  return (
    <div className="rounded-sm border border-border p-5">
      <h3 className="font-display text-xl">Suggestions après commande</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Produits affichés dans « Complétez votre look ». Enregistré automatiquement.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {rows.length === 0 ? (
          <li className="py-2 text-sm text-muted-foreground">Aucun produit sélectionné.</li>
        ) : null}
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center gap-2 py-2">
            <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
            <span className="flex-1 truncate text-sm">
              {byId.get(r.product_id)?.name ?? "Produit non publié"}
            </span>
            <Button size="icon" variant="ghost" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Monter">
              <ArrowUp className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" disabled={busy || i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">
              <ArrowDown className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" disabled={busy} onClick={() => remove(r.id)} aria-label="Retirer">
              <X className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <Input
        className="mt-4"
        placeholder="Rechercher un produit publié…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {results.length ? (
        <ul className="mt-2 divide-y divide-border rounded-sm border border-border">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => add(p.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {p.name}
                <Plus className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
