import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, formatDzd, type Product } from "@/lib/store";
import { uploadImage } from "@/lib/upload";

type VariantDraft = {
  id?: string;
  color_name: string;
  color_hex: string;
  image_url: string | null;
  stock_quantity: string;
  is_default: boolean;
};

type Draft = {
  id?: string;
  name: string;
  description: string;
  price: string;
  old_price: string;
  category_id: string;
  stock_quantity: string;
  status: string;
  featured: boolean;
  images: string[];
  variants: VariantDraft[];
};

const emptyDraft: Draft = {
  name: "",
  description: "",
  price: "",
  old_price: "",
  category_id: "",
  stock_quantity: "10",
  status: "published",
  featured: false,
  images: [],
  variants: [],
};


export function ProductsTab() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Product[];
    },
  });

  async function edit(product: Product) {
    const { data } = await (supabase as any)
      .from("product_variants")
      .select("*")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true });
    setDraft({
      id: product.id,
      name: product.name,
      description: product.description ?? "",
      price: String(product.price),
      old_price: product.old_price ? String(product.old_price) : "",
      category_id: product.category_id ?? "",
      stock_quantity: String(product.stock_quantity),
      status: product.status,
      featured: product.featured,
      images: [product.image_url, ...(product.image_urls ?? [])].filter(
        (value, index, all): value is string =>
          Boolean(value) && all.indexOf(value) === index,
      ),
      variants: ((data ?? []) as any[]).map((variant) => ({
        id: variant.id,
        color_name: variant.color_name,
        color_hex: variant.color_hex ?? "#000000",
        image_url: variant.image_url ?? null,
        stock_quantity: String(variant.stock_quantity ?? 0),
        is_default: Boolean(variant.is_default),
      })),
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !draft) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) urls.push(await uploadImage(file));
      setDraft({ ...draft, images: [...draft.images, ...urls] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de l'envoi");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function updateVariant(position: number, patch: Partial<VariantDraft>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            variants: current.variants.map((variant, index) =>
              index === position ? { ...variant, ...patch } : variant,
            ),
          }
        : current,
    );
  }

  async function handleVariantImage(position: number, file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      updateVariant(position, { image_url: url });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de l'envoi");
    } finally {
      setUploading(false);
    }
  }

  async function saveVariants(productId: string, variants: VariantDraft[]) {
    const rows = variants.filter((variant) => variant.color_name.trim());
    const keepIds = rows.map((variant) => variant.id).filter(Boolean) as string[];

    let deleteQuery = (supabase as any)
      .from("product_variants")
      .delete()
      .eq("product_id", productId);
    if (keepIds.length > 0) {
      deleteQuery = deleteQuery.not("id", "in", `(${keepIds.join(",")})`);
    }
    const { error: deleteError } = await deleteQuery;
    if (deleteError) throw new Error(deleteError.message);

    if (rows.length === 0) return;
    const payload = rows.map((variant, index) => ({
      ...(variant.id ? { id: variant.id } : {}),
      product_id: productId,
      color_name: variant.color_name.trim(),
      color_hex: variant.color_hex || "#000000",
      image_url: variant.image_url,
      stock_quantity: Number(variant.stock_quantity) || 0,
      sort_order: index,
      is_default: rows.some((row) => row.is_default)
        ? variant.is_default
        : index === 0,
    }));
    const { error } = await (supabase as any)
      .from("product_variants")
      .upsert(payload);
    if (error) throw new Error(error.message);
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim() || !draft.price) {
      toast.error("Nom et prix requis.");
      return;
    }
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      price: Number(draft.price),
      old_price: draft.old_price ? Number(draft.old_price) : null,
      category_id: draft.category_id || null,
      stock_quantity: Number(draft.stock_quantity) || 0,
      status: draft.status,
      featured: draft.featured,
      image_url: draft.images[0] ?? null,
      image_urls: draft.images.slice(1),
    };
    const query = draft.id
      ? (supabase as any)
          .from("products")
          .update(payload)
          .eq("id", draft.id)
          .select("id")
          .single()
      : (supabase as any).from("products").insert(payload).select("id").single();
    const { data, error } = await query;
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }
    try {
      await saveVariants(data.id as string, draft.variants);
    } catch (variantError) {
      setSaving(false);
      toast.error(
        variantError instanceof Error
          ? variantError.message
          : "Échec de l'enregistrement des variantes",
      );
      return;
    }
    setSaving(false);
    toast.success("Produit enregistré");
    setDraft(null);
    void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void queryClient.invalidateQueries({ queryKey: ["product_variants"] });
  }


  async function remove(id: string) {
    const { error } = await (supabase as any).from("products").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Produit supprimé");
    void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <div className="space-y-6">
      {!draft ? (
        <Button className="rounded-sm" onClick={() => setDraft({ ...emptyDraft })}>
          <Plus className="mr-2 size-4" /> Nouveau produit
        </Button>
      ) : (
        <div className="space-y-4 rounded-sm border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl">
              {draft.id ? "Modifier le produit" : "Nouveau produit"}
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setDraft(null)}>
              <X className="size-4" />
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label>Nom</Label>
              <Input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="rounded-sm"
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={draft.description}
                rows={4}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                className="rounded-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label>Prix (DA)</Label>
              <Input
                type="number"
                value={draft.price}
                onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                className="rounded-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label>Ancien prix (DA)</Label>
              <Input
                type="number"
                value={draft.old_price}
                onChange={(event) =>
                  setDraft({ ...draft, old_price: event.target.value })
                }
                className="rounded-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label>Stock</Label>
              <Input
                type="number"
                value={draft.stock_quantity}
                onChange={(event) =>
                  setDraft({ ...draft, stock_quantity: event.target.value })
                }
                className="rounded-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label>Catégorie</Label>
              <Select
                value={draft.category_id || "none"}
                onValueChange={(value) =>
                  setDraft({ ...draft, category_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Statut</Label>
              <Select
                value={draft.status}
                onValueChange={(value) => setDraft({ ...draft, status: value })}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Publié</SelectItem>
                  <SelectItem value="draft">Brouillon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={draft.featured}
                onCheckedChange={(checked) => setDraft({ ...draft, featured: checked })}
              />
              <Label>Best seller (mis en avant)</Label>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Images</Label>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => handleFiles(event.target.files)}
              className="text-sm"
            />
            {uploading ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Envoi en cours...
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-3">
              {draft.images.map((image) => (
                <div key={image} className="relative size-24 overflow-hidden rounded-sm">
                  <img src={image} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label="Retirer l'image"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        images: draft.images.filter((item) => item !== image),
                      })
                    }
                    className="absolute right-1 top-1 rounded-full bg-card p-1"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <Label>Couleurs (variantes)</Label>
            {draft.variants.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucune couleur — le produit utilisera le stock global.
              </p>
            ) : null}
            {draft.variants.map((variant, position) => (
              <div
                key={variant.id ?? `new-${position}`}
                className="flex flex-wrap items-end gap-3 rounded-sm border border-border p-3"
              >
                <div className="grid gap-1">
                  <Label className="text-xs">Nom</Label>
                  <Input
                    value={variant.color_name}
                    placeholder="Noir"
                    onChange={(event) =>
                      updateVariant(position, { color_name: event.target.value })
                    }
                    className="h-10 w-40 rounded-sm"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Couleur</Label>
                  <Input
                    type="color"
                    value={variant.color_hex}
                    onChange={(event) =>
                      updateVariant(position, { color_hex: event.target.value })
                    }
                    className="h-10 w-16 rounded-sm p-1"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Stock</Label>
                  <Input
                    type="number"
                    min={0}
                    value={variant.stock_quantity}
                    onChange={(event) =>
                      updateVariant(position, { stock_quantity: event.target.value })
                    }
                    className="h-10 w-24 rounded-sm"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Image</Label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      void handleVariantImage(position, event.target.files?.[0])
                    }
                    className="text-xs"
                  />
                </div>
                {variant.image_url ? (
                  <img
                    src={variant.image_url}
                    alt=""
                    className="size-12 rounded-sm object-cover"
                  />
                ) : null}
                <button
                  type="button"
                  aria-label="Supprimer la couleur"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      variants: draft.variants.filter((_, index) => index !== position),
                    })
                  }
                  className="rounded-sm p-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-fit rounded-sm"
              onClick={() =>
                setDraft({
                  ...draft,
                  variants: [
                    ...draft.variants,
                    {
                      color_name: "",
                      color_hex: "#000000",
                      image_url: null,
                      stock_quantity: "0",
                    },
                  ],
                })
              }
            >
              Ajouter une couleur
            </Button>
          </div>



          <Button onClick={save} disabled={saving} className="rounded-sm">
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-4 rounded-sm border border-border bg-card p-3"
            >
              <div className="size-14 shrink-0 overflow-hidden rounded-sm bg-secondary">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDzd(Number(product.price))} · stock {product.stock_quantity} ·{" "}
                  {product.status === "published" ? "publié" : "brouillon"}
                  {product.featured ? " · best seller" : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-sm"
                onClick={() => edit(product)}
              >
                Modifier
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-sm text-destructive"
                onClick={() => remove(product.id)}
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
