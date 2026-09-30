import { useI18n } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { OrderForm } from "@/components/checkout/OrderForm";
import { AddToCart } from "@/components/cart/AddToCart";
import { useFeature } from "@/lib/features";
import { hasQtyDiscount } from "@/lib/store";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ProductCard } from "@/components/site/ProductCard";
import { Button } from "@/components/ui/button";
import { trackPixel } from "@/lib/pixel";
import {
  formatDzd,
  productQuery,
  productVariantsQuery,
  productsQuery,
  publicSettingsQuery,
} from "@/lib/store";

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: "Produit — Glamour Touch" },
      {
        name: "description",
        content:
          "Commandez ce modèle Glamour Touch avec paiement à la livraison, livraison à domicile ou retrait en bureau.",
      },
      { property: "og:title", content: "Produit — Glamour Touch" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Paiement à la livraison, livraison dans les 58 wilayas.",
      },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { data: product, isLoading } = useQuery(productQuery(id));
  const { data: settings } = useQuery(publicSettingsQuery());
  const { data: variants = [] } = useQuery(productVariantsQuery(id));
  const [index, setIndex] = useState(0);
  const { t } = useI18n();
  const cartOn = useFeature("cart", true);
  const similarOn = useFeature("similar_products", false);
  const qtyDiscountOn = useFeature("qty_discount", false);
  const categoryId = product?.category_id ?? null;
  const { data: categoryProducts = [] } = useQuery({
    ...productsQuery(),
    enabled: similarOn && categoryId !== null,
  });

  const relatedProducts =
    similarOn && categoryId !== null && product
      ? categoryProducts
          .filter((item) => item.category_id === categoryId && item.id !== product.id)
          .slice(0, 4)
      : [];
  const showSimilar = relatedProducts.length >= 2;

  const orderedVariants = [...variants].sort((a, b) => a.sort_order - b.sort_order);
  const defaultVariant =
    orderedVariants.find((variant) => variant.is_default && variant.image_url) ??
    orderedVariants.find((variant) => variant.image_url) ??
    null;
  const variantImages = orderedVariants
    .map((variant) => variant.image_url)
    .filter((value): value is string => Boolean(value));

  const images = product
    ? [
        defaultVariant?.image_url ?? null,
        ...variantImages,
        product.image_url,
        ...(product.image_urls ?? []),
      ].filter(
        (value, position, all): value is string =>
          Boolean(value) && all.indexOf(value) === position,
      )
    : [];


  useEffect(() => {
    if (!product) return;
    trackPixel("ViewContent", {
      content_ids: [product.id],
      content_name: product.name,
      value: Number(product.price),
      currency: "DZD",
    });
  }, [product]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-10">
        {isLoading ? (
          <p className="py-24 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !product ? (
          <div className="py-24 text-center">
            <h1 className="font-display text-3xl">{t("product.notFound")}</h1>
            <Button asChild variant="outline" className="mt-6 rounded-sm">
              <Link to="/boutique">{t("product.back")}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid w-full gap-10 lg:grid-cols-2">
            <div className="min-w-0">
              <div className="relative aspect-4/5 overflow-hidden rounded-sm bg-secondary">
                {images[index] ? (
                  <img
                    src={images[index]}
                    alt={product.name}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <ImageIcon className="size-8 opacity-50" aria-hidden="true" />
                    {settings?.site_name || "Glamour Touch"}
                  </div>
                )}
                {images.length > 1 ? (
                  <>
                    <button
                      type="button"
                      aria-label={t("product.prev")}
                      onClick={() =>
                        setIndex((current) =>
                          current === 0 ? images.length - 1 : current - 1,
                        )
                      }
                      className="absolute start-3 top-1/2 -translate-y-1/2 rounded-full bg-card/85 p-2 text-foreground"
                    >
                      <ChevronLeft className="size-4 rtl:rotate-180" />
                    </button>
                    <button
                      type="button"
                      aria-label={t("product.next")}
                      onClick={() =>
                        setIndex((current) => (current + 1) % images.length)
                      }
                      className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-card/85 p-2 text-foreground"
                    >
                      <ChevronRight className="size-4 rtl:rotate-180" />
                    </button>
                  </>
                ) : null}
              </div>
              {images.length > 1 ? (
                <div className="mt-3 flex gap-3 overflow-x-auto">
                  {images.map((image, position) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setIndex(position)}
                      className={
                        "size-20 shrink-0 overflow-hidden rounded-sm border " +
                        (position === index ? "border-primary" : "border-border")
                      }
                    >
                      <img
                        src={image}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}

              {variants.length > 0 ? (
                <div className="mt-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {t("product.colors")}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {variants.map((variant) => {
                      const position = variant.image_url
                        ? images.indexOf(variant.image_url)
                        : -1;
                      const active = position >= 0 && position === index;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          title={`${variant.color_name}${variant.stock_quantity <= 0 ? t("product.soldOutSuffix") : ""}`}
                          aria-label={variant.color_name}
                          onClick={() => {
                            if (position >= 0) setIndex(position);
                          }}
                          className={
                            "size-9 rounded-full border-2 transition-opacity " +
                            (active ? "border-primary" : "border-border") +
                            (variant.stock_quantity <= 0 ? " opacity-40" : "")
                          }
                          style={{ backgroundColor: variant.color_hex }}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>


            <div className="min-w-0">
              <h1 className="font-display text-4xl break-words text-foreground">
                {product.name}
              </h1>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-2xl text-primary">{formatDzd(product.price)}</span>
                {product.old_price && product.old_price > product.price ? (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatDzd(Number(product.old_price))}
                  </span>
                ) : null}
              </div>
              {qtyDiscountOn && hasQtyDiscount(product) ? (
                <p className="mt-3 inline-block rounded-sm bg-accent px-3 py-1.5 text-sm text-primary">
                  {t("product.qtyDiscount", { n: Number(product.qty_discount_min), p: Number(product.qty_discount_percent) })}
                </p>
              ) : null}
              {product.description ? (
                <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              ) : null}
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {product.stock_quantity > 0
                  ? t("product.inStock", { n: product.stock_quantity })
                  : t("product.outOfStock")}
              </p>

              <div className="mt-8">
                <OrderForm product={product} />
              </div>
              {cartOn ? (
                <div className="mt-6">
                  <AddToCart product={product} cover={images[0] ?? null} />
                </div>
              ) : null}
            </div>
          </div>
        )}
        {showSimilar ? (
          <section className="mt-16">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {t("product.similar")}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
              {relatedProducts.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
