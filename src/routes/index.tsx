import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import heroBag from "@/assets/hero-bag.jpg";
import { ProductCard } from "@/components/site/ProductCard";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { categoriesQuery, productsQuery, publicSettingsQuery } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Glamour Touch — Sacs à main & Accessoires de luxe" },
      {
        name: "description",
        content:
          "Découvrez la collection Glamour Touch : sacs à main, portefeuilles, bijoux et montres. Paiement à la livraison dans les 58 wilayas.",
      },
      { property: "og:title", content: "Glamour Touch — Sacs & Accessoires de luxe" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content:
          "Sacs à main et accessoires élégants pour femme. Livraison à domicile ou en bureau, paiement à la livraison.",
      },
    ],
  }),
  component: Home,
});

function SectionTitle({ overline, title }: { overline: string; title: string }) {
  return (
    <div className="mb-10 text-center">
      <p className="text-[10px] uppercase tracking-luxe text-primary">{overline}</p>
      <h2 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">{title}</h2>
      <div className="mx-auto mt-4 h-px w-16 bg-primary/40" />
    </div>
  );
}

function Home() {
  const { data: products = [], isLoading } = useQuery(productsQuery());
  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: settings } = useQuery(publicSettingsQuery());
  const { t } = useI18n();

  const bestSellers = products.filter((product) => product.featured).slice(0, 8);
  const newArrivals = products.slice(0, 8);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="surface-hero">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div className="hero-copy-enter text-center md:text-start">
            <p className="text-[10px] uppercase tracking-luxe text-primary">
              {t("home.overline")}
            </p>
            <h1 className="mt-5 font-display text-4xl leading-tight text-foreground sm:text-5xl md:text-6xl">
              {settings?.hero_title || settings?.site_name || "Glamour Touch"}
            </h1>
            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground md:mx-0">
              {settings?.hero_subtitle || settings?.site_tagline || t("brand.tagline")}
            </p>
            <div className="mt-8 flex justify-center gap-3 md:justify-start">
              <Button asChild className="h-12 rounded-sm px-8 text-xs uppercase tracking-[0.2em]">
                <Link to="/boutique">{settings?.hero_button_text || t("home.cta")}</Link>
              </Button>
            </div>
          </div>
          <div className="hero-image-enter overflow-hidden rounded-sm shadow-soft">
            <img
              src={settings?.hero_image_url || heroBag}
              alt={t("home.heroAlt")}
              width={1600}
              height={1200}
              className="hero-image-zoom size-full object-cover"
            />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-5 py-20">
        {bestSellers.length > 0 ? (
          <section className="mb-24">
            <SectionTitle overline={t("home.bestOverline")} title={t("home.bestTitle")} />
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {bestSellers.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ) : null}

        {categories.length > 0 ? (
          <section className="mb-24">
            <SectionTitle overline={t("home.catOverline")} title={t("home.catTitle")} />
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to="/boutique"
                  search={{ categorie: category.slug }}
                  className="group relative aspect-square overflow-hidden rounded-sm bg-secondary"
                >
                  {category.image_url ? (
                    <img
                      src={category.image_url}
                      alt={category.name}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : null}
                  <span className="absolute inset-x-0 bottom-0 bg-card/85 py-3 text-center text-xs uppercase tracking-[0.2em] text-foreground">
                    {category.name}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <SectionTitle overline={t("home.newOverline")} title={t("home.newTitle")} />
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : newArrivals.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              {t("home.soon")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {newArrivals.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
