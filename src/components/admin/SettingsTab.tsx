import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Settings = {
  site_name: string;
  phone: string;
  whatsapp: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  meta_pixel_id: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  google_sheet_webhook_url: string;
};

const FIELDS: { key: keyof Settings; label: string; hint?: string }[] = [
  { key: "site_name", label: "Nom du site" },
  { key: "phone", label: "Téléphone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "instagram_url", label: "Instagram (URL)" },
  { key: "facebook_url", label: "Facebook (URL)" },
  { key: "tiktok_url", label: "TikTok (URL)" },
  { key: "meta_pixel_id", label: "Meta Pixel ID" },
  {
    key: "telegram_bot_token",
    label: "Telegram — Bot Token",
    hint: "Créez un bot via @BotFather puis collez le token ici.",
  },
  {
    key: "telegram_chat_id",
    label: "Telegram — Chat ID",
    hint: "Identifiant du canal ou de la conversation à notifier.",
  },
  {
    key: "google_sheet_webhook_url",
    label: "Google Sheet Webhook URL",
    hint: "URL du script Google Apps qui reçoit les commandes.",
  },
];

const empty: Settings = {
  site_name: "",
  phone: "",
  whatsapp: "",
  instagram_url: "",
  facebook_url: "",
  tiktok_url: "",
  meta_pixel_id: "",
  telegram_bot_token: "",
  telegram_chat_id: "",
  google_sheet_webhook_url: "",
};

export function SettingsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Settings>(empty);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data: row, error } = await (supabase as any)
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return row as Partial<Settings> | null;
    },
  });

  useEffect(() => {
    if (!data) return;
    setForm((current) => {
      const next = { ...current };
      for (const field of FIELDS) next[field.key] = data[field.key] ?? "";
      return next;
    });
  }, [data]);

  async function save() {
    setSaving(true);
    const payload = Object.fromEntries(
      FIELDS.map((field) => [field.key, form[field.key].trim() || null]),
    );
    const { error } = await (supabase as any)
      .from("app_settings")
      .update(payload)
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

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  return (
    <div className="max-w-2xl space-y-5">
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
      <Button onClick={save} disabled={saving} className="rounded-sm">
        {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Enregistrer
      </Button>
    </div>
  );
}
