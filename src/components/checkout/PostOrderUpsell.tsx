import { useQuery } from "@tanstack/react-query";

import { ProductCard } from "@/components/site/ProductCard";
import { useFeature } from "@/lib/features";
import { useI18n } from "@/lib/i18n";
import { productsQuery } from "@/lib/store";

/**
 * "Complétez votre look" — shown under the order success screens.
 * Gated by features.post_order_upsell (default OFF) and hidden when the
 * cart feature is off. Renders nothing when fewer than 2 products qualify.
 */
export function PostOrderUpsell({ excludeIds }: { excludeIds: string[] }) {
  const upsellOn = useFeature("post_order_upsell", false);
  const cartOn = useFeature("cart", true);
  const { t } = useI18n();
  const { data: products = [] } = useQuery({
    ...productsQuery(),
    enabled: upsellOn && cartOn,
  });

  if (!upsellOn || !cartOn) return null;

  const excluded = new Set(excludeIds);
  // Prefer best sellers (the `featured` flag), then newest — productsQuery already orders by created_at desc.
  const suggestions = products
    .filter((p) => !excluded.has(p.id))
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 3);
  if (suggestions.length < 2) return null;

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
