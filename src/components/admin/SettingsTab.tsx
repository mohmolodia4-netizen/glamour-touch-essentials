import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FEATURES, resolveFeature } from "@/lib/features";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/upload";

type Settings = {
  site_name: string;
  site_tagline: string;
  primary_color: string;
  logo_url: string;
  hero_title: string;
  hero_subtitle: string;
  hero_image_url: string;
  hero_button_text: string;
  phone: string;
  whatsapp: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  meta_pixel_id: string;
  tiktok_pixel_id: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  google_sheet_webhook_url: string;
};

const FIELDS: { key: keyof Settings; label: string; hint?: string }[] = [
  { key: "phone", label: "Téléphone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "instagram_url", label: "Instagram (URL)" },
  { key: "facebook_url", label: "Facebook (URL)" },
  { key: "tiktok_url", label: "TikTok (URL)" },
  { key: "meta_pixel_id", label: "Meta Pixel ID" },
  { key: "tiktok_pixel_id", label: "TikTok Pixel ID" },
  {
    key: "telegram_bot_token",
    label: "Telegram — Bot Token",
    hint: "Créez un bot via @BotFather puis collez le token ici.",
  },
  {
    key: "telegram_chat_id",
    label: "Telegram — Chat ID(s)",
    hint: "Un ou plusieurs identifiants séparés par des virgules (ex: 123456,-100987654).",
  },

  {
    key: "google_sheet_webhook_url",
    label: "Google Sheet Webhook URL",
    hint: "URL du script Google Apps qui reçoit les commandes.",
  },
];

const empty: Settings = {
  site_name: "Glamour Touch",
  site_tagline: "Bags & Accessories",
  primary_color: "#556959",
  logo_url: "",
  hero_title: "",
  hero_subtitle: "",
  hero_image_url: "",
  hero_button_text: "",
  phone: "",
  whatsapp: "",
  instagram_url: "",
  facebook_url: "",
  tiktok_url: "",
  meta_pixel_id: "",
  tiktok_pixel_id: "",
  telegram_bot_token: "",
  telegram_chat_id: "",
  google_sheet_webhook_url: "",
};

export function SettingsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Settings>(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "hero" | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data: row, error } = await (supabase as any)
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return row as (Partial<Settings> & { features?: Record<string, unknown> }) | null;
    },
  });

  useEffect(() => {
    if (!data) return;
    setForm((current) => {
      const next = { ...current };
      for (const field of FIELDS) next[field.key] = data[field.key] ?? "";
      next.site_name = data.site_name || empty.site_name;
      next.site_tagline = data.site_tagline || empty.site_tagline;
      next.primary_color = data.primary_color || empty.primary_color;
      next.logo_url = data.logo_url || "";
      next.hero_title = data.hero_title || "";
      next.hero_subtitle = data.hero_subtitle || "";
      next.hero_image_url = data.hero_image_url || "";
      next.hero_button_text = data.hero_button_text || "";
      return next;
    });
    setFeatures(
      Object.fromEntries(
        FEATURES.map((f) => [f.key, resolveFeature(data.features, f.key, f.default)]),
      ),
    );
  }, [data]);

  async function save() {
    if (!/^#[0-9a-fA-F]{6}$/.test(form.primary_color.trim())) {
      toast.error("Indiquez une couleur hexadécimale valide (#RRGGBB).");
      return;
    }
    setSaving(true);
    const payload = Object.fromEntries(
      FIELDS.map((field) => [field.key, form[field.key].trim() || null]),
    );
    const { error } = await (supabase as any)
      .from("app_settings")
      .update({ ...payload, site_name: form.site_name.trim() || empty.site_name, site_tagline: form.site_tagline.trim() || empty.site_tagline, primary_color: form.primary_color.trim(), logo_url: form.logo_url || null, hero_title: form.hero_title.trim() || null, hero_subtitle: form.hero_subtitle.trim() || null, hero_image_url: form.hero_image_url || null, hero_button_text: form.hero_button_text.trim() || null, features: { ...(data?.features ?? {}), ...features } })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Paramètres enregistrés");
    void queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    void queryClient.invalidateQueries({ queryKey: ["public_settings"] });
  }

  async function handleImage(file: File | undefined, field: "logo_url" | "hero_image_url") {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image valide.");
      return;
    }
    setUploading(field === "logo_url" ? "logo" : "hero");
    try {
      const url = await uploadImage(file);
      setForm((current) => ({ ...current, [field]: url }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de l'envoi");
    } finally {
      setUploading(null);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-sm border border-border p-5">
        <h3 className="font-display text-xl">Design & Contenu</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="site-name">Nom du site</Label>
            <Input id="site-name" value={form.site_name} onChange={(event) => setForm({ ...form, site_name: event.target.value })} className="rounded-sm" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="site-tagline">Slogan</Label>
            <Input id="site-tagline" value={form.site_tagline} onChange={(event) => setForm({ ...form, site_tagline: event.target.value })} className="rounded-sm" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="primary-color">Couleur principale</Label>
            <div className="flex items-center gap-2">
              <Input aria-label="Choisir la couleur" type="color" value={form.primary_color} onChange={(event) => setForm({ ...form, primary_color: event.target.value })} className="h-10 w-14 cursor-pointer rounded-sm p-1" />
              <Input id="primary-color" value={form.primary_color} onChange={(event) => setForm({ ...form, primary_color: event.target.value })} placeholder="#556959" className="rounded-sm" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Logo</Label>
            <div className="flex min-h-10 items-center gap-3">
              {form.logo_url ? <img src={form.logo_url} alt="Logo actuel" className="max-h-12 max-w-28 object-contain" /> : <ImageIcon className="size-5 text-muted-foreground" />}
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary">
                 {uploading === "logo" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                 {uploading === "logo" ? "Envoi..." : "Importer"}
                 <input type="file" accept="image/*" className="sr-only" disabled={!!uploading} onChange={(event) => { void handleImage(event.target.files?.[0], "logo_url"); event.target.value = ""; }} />
              </label>
              {form.logo_url ? <Button variant="ghost" size="icon" type="button" aria-label="Supprimer le logo" onClick={() => setForm({ ...form, logo_url: "" })}><X className="size-4" /></Button> : null}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-sm border border-border p-5">
        <h3 className="font-display text-xl">Page d'accueil</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="hero-title">Titre de la bannière</Label>
            <Input id="hero-title" value={form.hero_title} onChange={(event) => setForm({ ...form, hero_title: event.target.value })} placeholder={form.site_name || "Glamour Touch"} className="rounded-sm" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hero-button-text">Texte du bouton</Label>
            <Input id="hero-button-text" value={form.hero_button_text} onChange={(event) => setForm({ ...form, hero_button_text: event.target.value })} placeholder="Découvrir" className="rounded-sm" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="hero-subtitle">Sous-titre de la bannière</Label>
            <Input id="hero-subtitle" value={form.hero_subtitle} onChange={(event) => setForm({ ...form, hero_subtitle: event.target.value })} placeholder={form.site_tagline || "Bags & Accessories"} className="rounded-sm" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="hero-image">Image de la bannière</Label>
            <div className="flex flex-wrap items-center gap-3">
              {form.hero_image_url ? <img src={form.hero_image_url} alt="Image actuelle de la bannière" className="h-20 w-28 rounded-sm object-cover" /> : <ImageIcon className="size-5 text-muted-foreground" />}
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary">
                {uploading === "hero" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {uploading === "hero" ? "Envoi..." : "Importer"}
                <input id="hero-image" type="file" accept="image/*" className="sr-only" disabled={!!uploading} onChange={(event) => { void handleImage(event.target.files?.[0], "hero_image_url"); event.target.value = ""; }} />
              </label>
              {form.hero_image_url ? <Button variant="ghost" size="icon" type="button" aria-label="Retirer l'image de la bannière" onClick={() => setForm({ ...form, hero_image_url: "" })}><X className="size-4" /></Button> : null}
            </div>
            <p className="text-xs text-muted-foreground">Sans image importée, l'image actuelle reste affichée.</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key} className="grid gap-2">
            <Label>{field.label}</Label>
            <Input
              value={form[field.key]}
              type={field.key === "telegram_bot_token" ? "password" : "text"}
              onChange={(event) =>
                setForm({ ...form, [field.key]: event.target.value })
              }
              className="rounded-sm"
            />
            {field.hint ? (
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            ) : null}
          </div>
        ))}
      </div>
      <div className="rounded-sm border border-border p-5">
        <h3 className="font-display text-xl">Fonctionnalités</h3>
        <div className="mt-4 divide-y divide-border">
          {FEATURES.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm">{f.label}</span>
              <Switch
                checked={features[f.key] ?? f.default}
                onCheckedChange={(v) => setFeatures({ ...features, [f.key]: v })}
              />
            </label>
          ))}
        </div>
      </div>
      <Button onClick={save} disabled={saving || uploading} className="rounded-sm">
        {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Enregistrer
      </Button>
    </div>
  );
}
