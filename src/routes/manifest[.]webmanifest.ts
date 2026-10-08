import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type PwaConfig = {
  app_name?: string;
  short_name?: string;
  theme_color?: string;
  icon_192?: string;
  icon_512?: string;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async () => {
        let settings: Record<string, any> | null = null;
        try {
          const sb = createClient(
            process.env["VITE_SUPABASE_URL"] ?? import.meta.env.VITE_SUPABASE_URL,
            process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );
          const { data } = await sb.rpc("get_public_settings");
          settings = (Array.isArray(data) ? data[0] : data) ?? null;
        } catch {
          settings = null;
        }
        const enabled = settings?.features?.pwa === true;
        if (!enabled) return new Response("Not found", { status: 404 });

        const cfg: PwaConfig = settings?.feature_config?.pwa ?? {};
        const name = cfg.app_name || settings?.site_name || "Glamour Touch";
        const theme = cfg.theme_color && HEX.test(cfg.theme_color)
          ? cfg.theme_color
          : settings?.primary_color && HEX.test(settings.primary_color) ? settings.primary_color : "#556959";
        const icons = [
          cfg.icon_192 && { src: cfg.icon_192, sizes: "192x192", type: "image/png", purpose: "any" },
          cfg.icon_512 && { src: cfg.icon_512, sizes: "512x512", type: "image/png", purpose: "any" },
          cfg.icon_512 && { src: cfg.icon_512, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ].filter(Boolean);

        const manifest = {
          id: "/",
          name,
          short_name: cfg.short_name || name.slice(0, 12),
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#FAF8F3",
          theme_color: theme,
          icons,
        };
        return new Response(JSON.stringify(manifest), {
          headers: {
            "content-type": "application/manifest+json; charset=utf-8",
            "cache-control": "public, max-age=0, must-revalidate",
          },
        });
      },
    },
  },
});
