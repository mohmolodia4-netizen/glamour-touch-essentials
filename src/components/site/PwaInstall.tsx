import { useRouterState } from "@tanstack/react-router";
import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useFeature, useFeatureConfig } from "@/lib/features";
import { useI18n } from "@/lib/i18n";
import { syncServiceWorker } from "@/lib/pwa-register";

type PwaConfig = { theme_color?: string; icon_192?: string; show_banner?: boolean };
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "glamour-touch-pwa-dismissed";

function setHeadLink(rel: string, href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"][data-pwa]`);
  if (!href) return el?.remove();
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    el.dataset["pwa"] = "1";
    document.head.appendChild(el);
  }
  el.href = href;
}

function setThemeMeta(color: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-pwa]');
  if (!color) return el?.remove();
  if (!el) {
    el = document.createElement("meta");
    el.name = "theme-color";
    el.dataset["pwa"] = "1";
    document.head.appendChild(el);
  }
  el.content = color;
}

/** Mounted once at the root; renders nothing and runs nothing beyond cleanup while the feature is off. */
export function PwaInstall() {
  const enabled = useFeature("pwa", false);
  if (!enabled) return <PwaCleanup />;
  return <PwaActive />;
}

function PwaCleanup() {
  useEffect(() => {
    setHeadLink("manifest", null);
    setHeadLink("apple-touch-icon", null);
    setThemeMeta(null);
    void syncServiceWorker(false);
  }, []);
  return null;
}

function PwaActive() {
  const cfg = useFeatureConfig<PwaConfig>("pwa");
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHeadLink("manifest", "/manifest.webmanifest");
    setHeadLink("apple-touch-icon", cfg?.icon_192 || null);
    setThemeMeta(cfg?.theme_color || null);
  }, [cfg?.icon_192, cfg?.theme_color]);

  useEffect(() => {
    void syncServiceWorker(true);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    setHidden(standalone || dismissed);
    const ua = navigator.userAgent;
    setIos(/iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (cfg?.show_banner === false || hidden || pathname.startsWith("/admin")) return null;
  if (!deferred && !ios) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-sm border border-border bg-card p-4 shadow-lg">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("pwa.later")}
        className="absolute end-2 top-2 text-muted-foreground"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pe-5">
        {cfg?.icon_192 ? (
          <img src={cfg.icon_192} alt="" className="size-11 shrink-0 rounded-md object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-display text-base">{ios && !deferred ? t("pwa.iosTitle") : t("pwa.title")}</p>
          {ios && !deferred ? (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <Share className="size-3.5" /> {t("pwa.iosSteps")}
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">{t("pwa.desc")}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  className="rounded-sm"
                  onClick={async () => {
                    await deferred?.prompt();
                    const choice = await deferred?.userChoice;
                    setDeferred(null);
                    if (choice?.outcome === "accepted") setHidden(true);
                  }}
                >
                  <Download className="me-1 size-4" /> {t("pwa.install")}
                </Button>
                <Button size="sm" variant="ghost" className="rounded-sm" onClick={dismiss}>
                  {t("pwa.later")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
