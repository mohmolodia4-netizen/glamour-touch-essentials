import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";

import { useFeature } from "@/lib/features";
import { discountedUnit, productsQuery } from "@/lib/store";

export type CartItem = {
  product_id: string;
  product_name: string;
  price: number;
  image_url: string | null;
  color_name: string | null;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  unitPrice: (item: CartItem) => number;
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: string, colorName: string | null, quantity: number) => void;
  removeItem: (productId: string, colorName: string | null) => void;
  clearCart: () => void;
};

const STORAGE_KEY = "glamour-touch-cart";
const noop = () => {};
const EMPTY_CART: CartContextValue = {
  items: [],
  count: 0,
  subtotal: 0,
  unitPrice: (item) => Number(item.price),
  addItem: noop,
  updateQuantity: noop,
  removeItem: noop,
  clearCart: noop,
};
const CartContext = createContext<CartContextValue | null>(null);

const same = (item: CartItem, productId: string, colorName: string | null) =>
  item.product_id === productId && (item.color_name ?? null) === (colorName ?? null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      /* ignore corrupted storage */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const addItem = useCallback((item: CartItem) => {
    setItems((current) => {
      const existing = current.find((i) => same(i, item.product_id, item.color_name));
      if (existing) {
        return current.map((i) =>
          same(i, item.product_id, item.color_name)
            ? { ...i, quantity: i.quantity + Math.max(1, item.quantity) }
            : i,
        );
      }
      return [...current, { ...item, quantity: Math.max(1, item.quantity) }];
    });
  }, []);

  const updateQuantity = useCallback(
    (productId: string, colorName: string | null, quantity: number) => {
      setItems((current) =>
        quantity <= 0
          ? current.filter((i) => !same(i, productId, colorName))
          : current.map((i) => (same(i, productId, colorName) ? { ...i, quantity } : i)),
      );
    },
    [],
  );

  const removeItem = useCallback((productId: string, colorName: string | null) => {
    setItems((current) => current.filter((i) => !same(i, productId, colorName)));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const discountOn = useFeature("qty_discount", false);
  const { data: products = [] } = useQuery({ ...productsQuery(), enabled: discountOn && items.length > 0 });

  const unitPrice = useCallback(
    (item: CartItem) => {
      if (!discountOn) return Number(item.price);
      const p = products.find((x) => x.id === item.product_id);
      if (!p) return Number(item.price);
      const qty = items.filter((i) => i.product_id === item.product_id).reduce((s, i) => s + i.quantity, 0);
      return discountedUnit(Number(p.price), p.qty_discount_min, p.qty_discount_percent, qty, true);
    },
    [discountOn, products, items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: items.reduce((sum, i) => sum + unitPrice(i) * i.quantity, 0),
      unitPrice,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    }),
    [items, unitPrice, addItem, updateQuantity, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  // Pages rendered outside the provider (error/404 screens) get an empty cart.
  return ctx ?? EMPTY_CART;
}
