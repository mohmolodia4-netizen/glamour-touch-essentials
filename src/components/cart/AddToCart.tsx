import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/lib/cart";
import { productVariantsQuery, type Product } from "@/lib/store";

/** Uses the same variant data (productVariantsQuery) as the order form. */
export function AddToCart({ product, cover }: { product: Product; cover: string | null }) {
  const { addItem } = useCart();
  const { data: variants = [] } = useQuery(productVariantsQuery(product.id));
  const available = useMemo(() => variants.filter((v) => v.stock_quantity > 0), [variants]);
  const hasVariants = variants.length > 0;
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (hasVariants && !color && available[0]) setColor(available[0].color_name);
  }, [hasVariants, color, available]);

  const selected = variants.find((v) => v.color_name === color);
  const stock = hasVariants ? (selected?.stock_quantity ?? 0) : product.stock_quantity;

  function add() {
    if (hasVariants && !selected) {
      toast.error("Veuillez choisir une couleur.");
      return;
    }
    addItem({
      product_id: product.id,
      product_name: product.name,
      price: Number(product.price),
      image_url: selected?.image_url ?? cover,
      color_name: hasVariants ? color : null,
      quantity,
    });
    toast.success("Ajouté au panier", {
      action: { label: "Voir", onClick: () => (window.location.href = "/checkout") },
    });
  }

  return (
    <div className="rounded-sm border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Ou ajoutez au panier pour commander plusieurs articles
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {hasVariants ? (
          <select
            aria-label="Couleur"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-sm border border-border bg-background px-3 text-sm"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.color_name} disabled={v.stock_quantity <= 0}>
                {v.color_name}
                {v.stock_quantity <= 0 ? " — épuisé" : ""}
              </option>
            ))}
          </select>
        ) : null}
        <Input
          type="number"
          aria-label="Quantité"
          min={1}
          max={Math.max(stock, 1)}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          className="h-11 w-20 rounded-sm"
        />
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={stock <= 0}
          className="h-11 rounded-sm uppercase tracking-[0.15em]"
        >
          <ShoppingBag className="mr-2 size-4" /> Ajouter au panier
        </Button>
      </div>
      <Link to="/checkout" className="mt-3 inline-block text-xs text-primary underline">
        Voir mon panier
      </Link>
    </div>
  );
}
