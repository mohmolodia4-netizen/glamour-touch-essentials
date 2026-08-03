import { Link } from "@tanstack/react-router";

import { formatDzd, type Product } from "@/lib/store";

export function ProductCard({ product }: { product: Product }) {
  const discounted = product.old_price && product.old_price > product.price;

  return (
    <Link
      to="/product/$id"
      params={{ id: product.id }}
      className="group block"
      aria-label={product.name}
    >
      <div className="relative aspect-4/5 overflow-hidden rounded-sm bg-secondary">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
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
