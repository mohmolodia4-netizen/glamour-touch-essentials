import { useQuery } from "@tanstack/react-query";

import { ProductCard } from "@/components/site/ProductCard";
import { useFeature } from "@/lib/features";
import { useI18n } from "@/lib/i18n";
import { crossSellQuery, productsQuery } from "@/lib/store";

/**
 * "Complétez votre look" — shown under the order success screens.
 * Shows admin-picked products (cross_sell_products, by sort_order), minus
 * the current order's items. Gated by features.post_order_upsell and cart.
 */
export function PostOrderUpsell({ excludeIds }: { excludeIds: string[] }) {
  const upsellOn = useFeature("post_order_upsell", false);
  const cartOn = useFeature("cart", true);
  const { t } = useI18n();
  const enabled = upsellOn && cartOn;
  const { data: products = [] } = useQuery({ ...productsQuery(), enabled });
  const { data: picks = [] } = useQuery({ ...crossSellQuery(), enabled });

  if (!enabled) return null;

  const excluded = new Set(excludeIds);
  const byId = new Map(products.map((p) => [p.id, p]));
  const suggestions = picks
    .filter((r) => !excluded.has(r.product_id))
    .map((r) => byId.get(r.product_id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  if (suggestions.length < 1) return null;

  return (
    <section aria-label={t("upsell.title")}>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {t("upsell.title")}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
        {suggestions.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </section>
  );
}
