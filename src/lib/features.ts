import { useQuery } from "@tanstack/react-query";

import { publicSettingsQuery } from "@/lib/store";

export const FEATURES: { key: string; label: string; default: boolean }[] = [
  { key: "cart", label: "Panier", default: true },
  { key: "whatsapp_order", label: "Commander via WhatsApp (par produit)", default: true },
  { key: "similar_products", label: "Produits similaires", default: false },
  { key: "wishlist", label: "Favoris", default: false },
  { key: "bundles", label: "Packs", default: false },
  { key: "qty_discount", label: "Remise sur quantité", default: false },
  { key: "post_order_upsell", label: "Suggestions après commande", default: false },
  { key: "whatsapp_confirm", label: "Confirmation WhatsApp après commande", default: false },
  { key: "order_alerts", label: "Alerte son nouvelle commande (admin)", default: false },
  { key: "dashboard", label: "Tableau de bord (admin)", default: false },
  { key: "free_shipping", label: "Livraison gratuite", default: false },
  { key: "coupons", label: "Codes promo", default: false },
  { key: "pwa", label: "Application (PWA)", default: false },
];

export function resolveFeature(
  features: Record<string, unknown> | null | undefined,
  key: string,
  defaultValue = false,
) {
  const v = features?.[key];
  return typeof v === "boolean" ? v : defaultValue;
}

export function useFeature(key: string, defaultValue = false) {
  const { data } = useQuery(publicSettingsQuery());
  return resolveFeature(data?.features, key, defaultValue);
}

export function useFeatureConfig<T = Record<string, unknown>>(key: string): T | null {
  const { data } = useQuery(publicSettingsQuery());
  const value = data?.feature_config?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as T;
}

/** Free-shipping threshold in DA when the feature is on and configured, else null. */
export function useFreeShippingThreshold(): number | null {
  const on = useFeature("free_shipping", false);
  const config = useFeatureConfig<{ threshold?: unknown }>("free_shipping");
  const amount = Number(config?.threshold);
  return on && Number.isFinite(amount) && amount > 0 ? amount : null;
}
