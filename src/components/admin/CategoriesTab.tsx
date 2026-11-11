import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/store";
import { uploadImage } from "@/lib/upload";

type Draft = {
  id?: string;
  name: string;
  slug: string;
  image_url: string;
  sort_order: string;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function CategoriesTab() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("*")
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as Category[];
    },
  });

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Nom requis.");
      return;
    }
    setBusy(true);
    const payload = {
      name: draft.name.trim(),
      slug: draft.slug.trim() || slugify(draft.name),
      image_url: draft.image_url || null,
      sort_order: Number(draft.sort_order) || 0,
    };
    const query = draft.id
      ? (supabase as any).from("categories").update(payload).eq("id", draft.id)
      : (supabase as any).from("categories").insert(payload);
    const { error } = await query;
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Catégorie enregistrée");
    setDraft(null);
    void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
  }

  async function remove(id: string) {
    const { error } = await (supabase as any).from("categories").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
  }

  return (
    <div className="space-y-6">
      {!draft ? (
        <Button
          className="rounded-sm"
          onClick={() =>
            setDraft({ name: "", slug: "", image_url: "", sort_order: "0" })
          }
        >
          <Plus className="mr-2 size-4" /> Nouvelle catégorie
        </Button>
      ) : (
        <div className="space-y-4 rounded-sm border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl">
              {draft.id ? "Modifier la catégorie" : "Nouvelle catégorie"}
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setDraft(null)}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Nom</Label>
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    name: event.target.value,
                    slug: draft.id ? draft.slug : slugify(event.target.value),
                  })
                }
                className="rounded-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label>Slug</Label>
              <Input
                value={draft.slug}
                onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                className="rounded-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label>Ordre</Label>
              <Input
                type="number"
                value={draft.sort_order}
                onChange={(event) =>
                  setDraft({ ...draft, sort_order: event.target.value })
                }
                className="rounded-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label>Image</Label>
              <input
                type="file"
                accept="image/*"
                className="text-sm"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  try {
                    const url = await uploadImage(file);
                    setDraft((current) =>
                      current ? { ...current, image_url: url } : current,
                    );
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Échec de l'envoi",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </div>
          </div>
          {draft.image_url ? (
            <img
              src={draft.image_url}
              alt=""
              className="size-24 rounded-sm object-cover"
            />
          ) : null}
          <Button onClick={save} disabled={busy} className="rounded-sm">
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center gap-4 rounded-sm border border-border bg-card p-3"
            >
              <div className="size-12 shrink-0 overflow-hidden rounded-sm bg-secondary">
                {category.image_url ? (
                  <img
                    src={category.image_url}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{category.name}</p>
                <p className="text-xs text-muted-foreground">/{category.slug}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-sm"
                onClick={() =>
                  setDraft({
                    id: category.id,
                    name: category.name,
                    slug: category.slug,
                    image_url: category.image_url ?? "",
                    sort_order: String(category.sort_order),
                  })
                }
              >
                Modifier
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-sm text-destructive"
                onClick={() => remove(category.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
