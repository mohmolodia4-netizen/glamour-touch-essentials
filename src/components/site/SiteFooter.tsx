import { useQuery } from "@tanstack/react-query";
import { Instagram, Facebook, Phone } from "lucide-react";

import { publicSettingsQuery } from "@/lib/store";

export function SiteFooter() {
  const { data: settings } = useQuery(publicSettingsQuery());

  return (
    <footer className="mt-24 border-t border-border bg-secondary/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-3">
        <div>
          <p className="font-display text-xl tracking-[0.24em] text-primary">
            {settings?.site_name ?? "GLAMOUR TOUCH"}
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Sacs à main, accessoires, montres et bijoux sélectionnés pour la femme
            élégante. Livraison partout en Algérie, paiement à la livraison.
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-foreground">Service</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Paiement à la livraison</li>
            <li>Livraison 58 wilayas</li>
            <li>Retrait en bureau (Stopdesk)</li>
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-foreground">Contact</p>
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
        © {new Date().getFullYear()} GLAMOUR TOUCH
      </div>
    </footer>
  );
}
