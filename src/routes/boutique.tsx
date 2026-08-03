import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ProductCard } from "@/components/site/ProductCard";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { categoriesQuery, productsQuery } from "@/lib/store";
import { cn } from "@/lib/utils";

type BoutiqueSearch = { categorie?: string };

export const Route = createFileRoute("/boutique")({
  validateSearch: (search: Record<string, unknown>): BoutiqueSearch => ({
    categorie: typeof search.categorie === "string" ? search.categorie : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Boutique — Glamour Touch" },
      {
        name: "description",
        content:
          "Toute la collection Glamour Touch : sacs à main, portefeuilles, bijoux, montres et accessoires pour femme.",
      },
      { property: "og:title", content: "Boutique — Glamour Touch" },
      {
        property: "og:description",
        content: "Sacs à main et accessoires de luxe, paiement à la livraison.",
      },
    ],
  }),
  component: Boutique,
});

function Boutique() {
  const { categorie } = Route.useSearch();
  const { data: products = [], isLoading } = useQuery(productsQuery());
  const { data: categories = [] } = useQuery(categoriesQuery());

  const active = categories.find((category) => category.slug === categorie) ?? null;
  const visible = active
    ? products.filter((product) => product.category_id === active.id)
    : products;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-14">
        <header className="text-center">
          <p className="text-[10px] uppercase tracking-luxe text-primary">Collection</p>
          <h1 className="mt-3 font-display text-4xl text-foreground">
            {active ? active.name : "La Boutique"}
          </h1>
        </header>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Link
            to="/boutique"
            className={cn(
              "rounded-sm border border-border px-4 py-2 text-xs uppercase tracking-[0.18em]",
              !active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            Tout
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              to="/boutique"
              search={{ categorie: category.slug }}
              className={cn(
                "rounded-sm border border-border px-4 py-2 text-xs uppercase tracking-[0.18em]",
                active?.id === category.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {category.name}
            </Link>
          ))}
        </div>

        <div className="mt-12">
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground">Chargement...</p>
          ) : visible.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Aucun produit dans cette catégorie pour le moment.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {visible.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
