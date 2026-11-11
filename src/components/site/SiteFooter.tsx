import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Instagram, Facebook, Phone } from "lucide-react";

import { publicSettingsQuery } from "@/lib/store";

export function SiteFooter() {
  const { data: settings } = useQuery(publicSettingsQuery());
  const { t } = useI18n();

  return (
    <footer className="mt-24 border-t border-border bg-secondary/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-3">
        <div>
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt={settings.site_name || "Glamour Touch"} className="max-h-14 max-w-44 object-contain" />
          ) : (
            <p className="font-display text-xl text-primary">{settings?.site_name || "Glamour Touch"}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{settings?.site_tagline || t("brand.tagline")}</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {t("footer.about")}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-foreground">{t("footer.service")}</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>{t("footer.cod")}</li>
            <li>{t("footer.shipping")}</li>
            <li>{t("footer.stopdesk")}</li>
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-foreground">{t("footer.contact")}</p>
          <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
            {settings?.phone ? (
              <a
                href={`tel:${settings.phone}`}
                className="inline-flex items-center gap-2 hover:text-primary"
              >
                <Phone className="size-4" /> {settings.phone}
              </a>
            ) : null}
            <div className="flex gap-4">
              {settings?.instagram_url ? (
                <a
                  href={settings.instagram_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="hover:text-primary"
                >
                  <Instagram className="size-5" />
                </a>
              ) : null}
              {settings?.facebook_url ? (
                <a
                  href={settings.facebook_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  className="hover:text-primary"
                >
                  <Facebook className="size-5" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs tracking-[0.18em] text-muted-foreground">
        © {new Date().getFullYear()} {settings?.site_name || "Glamour Touch"}
      </div>
    </footer>
  );
}
