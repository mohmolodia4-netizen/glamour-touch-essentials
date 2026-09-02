import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";

import {
  formatDzd,
  pickVariantCover,
  variantCoversQuery,
  type Product,
} from "@/lib/store";

export function ProductCard({ product }: { product: Product }) {
  const discounted = product.old_price && product.old_price > product.price;
  const { data: covers = [] } = useQuery(variantCoversQuery());

  const cover =
    pickVariantCover(covers, product.id) ??
    product.image_url ??
    product.image_urls?.[0] ??
    null;

  return (
    <Link
      to="/product/$id"
      params={{ id: product.id }}
      className="group block"
      aria-label={product.name}
    >
      <div className="relative aspect-4/5 overflow-hidden rounded-sm bg-secondary">
        {cover ? (
          <img
            src={cover}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <ImageIcon className="size-6 opacity-50" aria-hidden="true" />
            Glamour Touch
          </div>
        )}
        {discounted ? (
          <span className="absolute left-3 top-3 rounded-sm bg-primary px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-primary-foreground">
            Promo
          </span>
        ) : null}
        {product.stock_quantity <= 0 ? (
          <span className="absolute right-3 top-3 rounded-sm bg-card px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Épuisé
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-1 text-center">
        <h3 className="font-display text-lg text-foreground">{product.name}</h3>
        <p className="flex items-center justify-center gap-2 text-sm">
          <span className="text-primary">{formatDzd(product.price)}</span>
          {discounted ? (
            <span className="text-xs text-muted-foreground line-through">
              {formatDzd(Number(product.old_price))}
            </span>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
