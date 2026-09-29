import { useQuery } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCart } from "@/lib/cart";
import { useFeature } from "@/lib/features";
import { useI18n } from "@/lib/i18n";
import { productVariantsQuery, type Product, type ProductVariant } from "@/lib/store";

/** Quick add button for product cards. Uses the same variant data as the product page. */
export function QuickAddToCart({
  product,
  cover,
  hasVariants,
}: {
  product: Product;
  cover: string | null;
  hasVariants: boolean;
}) {
  const cartOn = useFeature("cart", true);
  const { addItem } = useCart();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { data: variants = [], isLoading } = useQuery({
    ...productVariantsQuery(product.id),
    enabled: hasVariants && open,
  });

  if (!cartOn) return null;

  function add(variant: ProductVariant | null) {
    addItem({
      product_id: product.id,
      product_name: product.name,
      price: Number(product.price),
      image_url: variant?.image_url ?? cover,
      color_name: variant?.color_name ?? null,
      quantity: 1,
    });
    setOpen(false);
    toast.success(t("cart.added"), {
      description: variant ? `${product.name} — ${variant.color_name}` : product.name,
      action: { label: t("cart.see"), onClick: () => (window.location.href = "/checkout") },
    });
  }

  const btnClass =
    "flex h-9 w-full items-center justify-center gap-2 rounded-sm bg-card/90 text-[10px] uppercase tracking-[0.18em] text-foreground shadow-soft backdrop-blur transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50";

  if (!hasVariants) {
    return (
      <button
        type="button"
        className={btnClass}
        disabled={product.stock_quantity <= 0}
        onClick={() => add(null)}
      >
        <ShoppingBag className="size-3.5" /> {t("cart.add")}
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={btnClass} disabled={product.stock_quantity <= 0}>
          <ShoppingBag className="size-3.5" /> {t("cart.add")}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="center">
        <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {t("form.color")}
        </p>
        {isLoading ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <ul className="space-y-1">
            {variants.map((v) => {
              const out = v.stock_quantity <= 0;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    disabled={out}
                    onClick={() => add(v)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span
                      className="size-4 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: v.color_hex }}
                    />
                    <span className="flex-1">{v.color_name}</span>
                    {out ? (
                      <span className="text-[10px] text-muted-foreground">{t("card.soldOut")}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
