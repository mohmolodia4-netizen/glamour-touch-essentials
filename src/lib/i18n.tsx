import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import fr from "@/locales/fr.json";
import ar from "@/locales/ar.json";

export type Lang = "fr" | "ar";
export type TKey = keyof typeof fr;
const dict: Record<Lang, Record<string, string>> = { fr, ar };
const STORAGE_KEY = "glamour-touch-lang";

type Ctx = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
};

function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>) {
  let text = dict[lang][key] ?? fr[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, String(v));
  return text;
}

const I18nContext = createContext<Ctx>({
  lang: "fr",
  setLang: () => {},
  t: (key, vars) => translate("fr", key, vars),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ar" || saved === "fr") setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback<Ctx["t"]>((key, vars) => translate(lang, key, vars), [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Admin pages stay French: forces LTR while mounted. */
export function useForceFrench() {
  useEffect(() => {
    const prev = document.documentElement.dir;
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "fr";
    return () => {
      document.documentElement.dir = prev;
    };
  }, []);
}
