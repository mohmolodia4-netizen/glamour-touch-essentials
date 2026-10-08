import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FeatureActivationCard } from "@/components/admin/FeatureActivationCard";
import { saveFeatureConfig } from "@/components/admin/feature-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFeature, useFeatureConfig } from "@/lib/features";
import { uploadImage } from "@/lib/upload";

type PwaConfig = {
  app_name: string;
  short_name: string;
  theme_color: string;
  icon_192: string;
  icon_512: string;
  show_banner: boolean;
};

const EMPTY: PwaConfig = {
  app_name: "",
  short_name: "",
  theme_color: "#556959",
  icon_192: "",
  icon_512: "",
  show_banner: true,
};

export function PwaTab() {
  const queryClient = useQueryClient();
  const enabled = useFeature("pwa", false);
  const stored = useFeatureConfig<Partial<PwaConfig>>("pwa");
  const [form, setForm] = useState<PwaConfig>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (stored) setForm({ ...EMPTY, ...stored });
  }, [stored]);

  const set = <K extends keyof PwaConfig>(k: K, v: PwaConfig[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function upload(key: "icon_192" | "icon_512", file: File | undefined) {
    if (!file) return;
    setUploading(key);
    try {
      set(key, await uploadImage(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'envoi");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (form.theme_color && !/^#[0-9a-fA-F]{6}$/.test(form.theme_color)) {
      toast.error("Couleur invalide (format #RRGGBB)");
      return;
    }
    setBusy(true);
    try {
      await saveFeatureConfig(queryClient, "pwa", { ...form, app_name: form.app_name.trim(), short_name: form.short_name.trim() });
      toast.success("Paramètres enregistrés");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <FeatureActivationCard
        featureKey="pwa"
        description="Permet aux clientes d'installer la boutique sur leur écran d'accueil."
      />
      <Card className="rounded-sm">
        <CardHeader>
          <CardTitle className="text-base">Application</CardTitle>
          <CardDescription>
            Nom, couleur et icônes affichés une fois l'application installée. Le mode hors ligne ne garde que les fichiers du site, jamais les commandes ni les données.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset disabled={!enabled || busy} className="space-y-5 disabled:opacity-60">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nom de l'application</Label>
                <Input value={form.app_name} onChange={(e) => set("app_name", e.target.value)} placeholder="Glamour Touch" className="rounded-sm" />
              </div>
              <div className="grid gap-2">
                <Label>Nom court (écran d'accueil)</Label>
                <Input value={form.short_name} maxLength={12} onChange={(e) => set("short_name", e.target.value)} placeholder="Glamour" className="rounded-sm" />
              </div>
              <div className="grid gap-2">
                <Label>Couleur du thème</Label>
                <div className="flex gap-2">
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(form.theme_color) ? form.theme_color : "#556959"} onChange={(e) => set("theme_color", e.target.value)} className="h-9 w-12 cursor-pointer rounded-sm border border-input bg-background" />
                  <Input value={form.theme_color} onChange={(e) => set("theme_color", e.target.value)} className="rounded-sm" />
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["icon_192", "icon_512"] as const).map((key) => (
                <div key={key} className="grid gap-2">
                  <Label>Icône {key === "icon_192" ? "192 × 192" : "512 × 512"} (PNG)</Label>
                  <div className="flex items-center gap-3">
                    <div className="flex size-16 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                      {form[key] ? <img src={form[key]} alt="" className="size-full object-cover" /> : null}
                    </div>
                    <Button asChild variant="outline" size="sm" className="rounded-sm">
                      <label className="cursor-pointer">
                        {uploading === key ? <Loader2 className="me-1 size-4 animate-spin" /> : <Upload className="me-1 size-4" />}
                        Choisir
                        <input type="file" accept="image/png" className="hidden" onChange={(e) => void upload(key, e.target.files?.[0])} />
                      </label>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 rounded-sm border border-border p-3">
              <div>
                <p className="text-sm font-medium">Afficher la bannière d'installation</p>
                <p className="text-xs text-muted-foreground">Bouton « Installer l'application » et instructions iPhone sur la boutique.</p>
              </div>
              <Switch checked={form.show_banner} onCheckedChange={(v) => set("show_banner", v)} />
            </div>
            <Button onClick={() => void save()} className="rounded-sm">
              {busy ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
              Enregistrer
            </Button>
          </fieldset>
        </CardContent>
      </Card>
    </div>
  );
}
