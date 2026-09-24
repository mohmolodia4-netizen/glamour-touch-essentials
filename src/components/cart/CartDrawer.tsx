import { Link } from "@tanstack/react-router";
import { ImageIcon, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";
import { formatDzd } from "@/lib/store";

export function CartLines() {
  const { items, updateQuantity, removeItem } = useCart();
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={`${item.product_id}-${item.color_name}`} className="flex gap-3 py-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-sm bg-secondary">
            {item.image_url ? (
              <img src={item.image_url} alt="" className="size-full object-cover" />
            ) : (
              <ImageIcon className="m-auto mt-5 size-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground">{item.product_name}</p>
            {item.color_name ? (
              <p className="text-xs text-muted-foreground">{item.color_name}</p>
            ) : null}
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                aria-label="Diminuer"
                onClick={() => updateQuantity(item.product_id, item.color_name, item.quantity - 1)}
                className="rounded-sm border border-border p-1"
              >
                <Minus className="size-3" />
              </button>
              <span className="w-6 text-center text-sm">{item.quantity}</span>
              <button
                type="button"
                aria-label="Augmenter"
                onClick={() => updateQuantity(item.product_id, item.color_name, item.quantity + 1)}
                className="rounded-sm border border-border p-1"
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>
          <div className="flex flex-col items-end justify-between">
            <button
              type="button"
              aria-label="Retirer"
              onClick={() => removeItem(item.product_id, item.color_name)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="size-4" />
            </button>
            <span className="text-sm text-primary">
              {formatDzd(item.price * item.quantity)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CartDrawer() {
  const { items, count, subtotal } = useCart();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Panier" className="relative">
          <ShoppingBag className="size-5" />
          {count > 0 ? (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {count}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetTitle className="font-display text-2xl">Mon panier</SheetTitle>
        {items.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Votre panier est vide.</p>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <CartLines />
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex justify-between font-display text-xl">
                <span>Sous-total</span>
                <span>{formatDzd(subtotal)}</span>
              </div>
              <Button asChild className="mt-4 h-12 w-full rounded-sm uppercase tracking-[0.18em]">
                <Link to="/checkout" onClick={() => setOpen(false)}>
                  Commander
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
