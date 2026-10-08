import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  old_price: number | null;
  image_url: string | null;
  image_urls: string[];
  category_id: string | null;
  stock_quantity: number;
  status: string;
  featured: boolean;
  created_at: string;
  qty_discount_min?: number | null;
  qty_discount_percent?: number | null;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  status: string;
  sort_order: number;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  color_name: string;
  color_hex: string;
  image_url: string | null;
  stock_quantity: number;
  sort_order: number;
  is_default: boolean;
};

export type VariantCover = {
  product_id: string;
  image_url: string | null;
  is_default: boolean;
  sort_order: number;
};

/** Default (featured) image for a product, based on its color variants. */
export function pickVariantCover(
  covers: VariantCover[],
  productId: string,
): string | null {
  const rows = covers
    .filter((cover) => cover.product_id === productId && cover.image_url)
    .sort((a, b) => a.sort_order - b.sort_order);
  if (rows.length === 0) return null;
  return (rows.find((row) => row.is_default) ?? rows[0])?.image_url ?? null;
}

export type ShippingRate = {
  wilaya_code: number;
  wilaya_name: string;
  domicile_fee: number;
  stopdesk_fee: number;
  active?: boolean;
};

export type Commune = { commune_name: string; postal_code: string | null };
export type Stopdesk = {
  commune_name: string;
  desk_name: string;
  desk_code: string | null;
  address: string;
};

export type PublicSettings = {
  site_name: string | null;
  site_tagline: string | null;
  primary_color: string | null;
  logo_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  hero_button_text: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  meta_pixel_id: string | null;
  tiktok_pixel_id: string | null;
  features: Record<string, unknown> | null;
  feature_config: Record<string, unknown> | null;
};

const table = (name: string) => (supabase as any).from(name);
const rpc = (name: string, args?: Record<string, unknown>) =>
  (supabase as any).rpc(name, args);

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

export const productsQuery = () => ({
  queryKey: ["products"],
  queryFn: async () =>
    unwrap<Product[]>(
      await table("products")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false }),
    ),
});

export type CrossSellRow = { id: string; product_id: string; sort_order: number };
export const crossSellQuery = () => ({
  queryKey: ["cross_sell"],
  queryFn: async () =>
    unwrap<CrossSellRow[]>(
      await table("cross_sell_products")
        .select("id, product_id, sort_order")
        .order("sort_order", { ascending: true }),
    ),
});

export const productQuery = (id: string) => ({
  queryKey: ["product", id],
  queryFn: async () => {
    const { data, error } = await table("products")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Product | null;
  },
});

export const productVariantsQuery = (productId: string) => ({
  queryKey: ["product_variants", productId],
  queryFn: async () =>
    unwrap<ProductVariant[]>(
      await table("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("sort_order", { ascending: true }),
    ),
});

export const variantCoversQuery = () => ({
  queryKey: ["variant_covers"],
  queryFn: async () =>
    unwrap<VariantCover[]>(
      await table("product_variants")
        .select("product_id, image_url, is_default, sort_order")
        .order("sort_order", { ascending: true }),
    ),
});

export const categoriesQuery = () => ({
  queryKey: ["categories"],
  queryFn: async () =>
    unwrap<Category[]>(
      await table("categories")
        .select("*")
        .eq("status", "published")
        .order("sort_order", { ascending: true }),
    ),
});

export const shippingRatesQuery = () => ({
  queryKey: ["shipping_rates"],
  queryFn: async () =>
    unwrap<ShippingRate[]>(
      await table("shipping_rates").select("*").eq("active", true).order("wilaya_code"),
    ),
});

export const communesQuery = (wilayaCode: number | null) => ({
  queryKey: ["communes", wilayaCode],
  enabled: wilayaCode !== null,
  queryFn: async () =>
    unwrap<Commune[]>(
      await table("communes")
        .select("commune_name, postal_code")
        .eq("wilaya_code", wilayaCode)
        .order("commune_name"),
    ),
});

export const stopdesksQuery = (wilayaCode: number | null) => ({
  queryKey: ["stopdesks", wilayaCode],
  enabled: wilayaCode !== null,
  queryFn: async () =>
    unwrap<Stopdesk[]>(
      await table("stopdesks")
        .select("commune_name, desk_name, desk_code, address")
        .eq("wilaya_code", wilayaCode)
        .eq("active", true)
        .order("commune_name"),
    ),
});

export const publicSettingsQuery = () => ({
  queryKey: ["public_settings"],
  queryFn: async () => {
    const { data, error } = await rpc("get_public_settings");
    if (error) throw new Error(error.message);
    return ((data as PublicSettings[])?.[0] ?? null) as PublicSettings | null;
  },
});

export type OrderLine = { color_name: string | null; quantity: number };

export async function placeOrder(input: {
  productId: string;
  items: OrderLine[];
  fullName: string;
  phone: string;
  wilayaCode: number;
  commune: string;
  deliveryType: "domicile" | "stopdesk";
  adresse: string;
  deskCode?: string;
  couponCode?: string | null;
}) {
  const { data, error } = await rpc("place_order_items", {
    ...(input.couponCode ? { _coupon_code: input.couponCode } : {}),
    _product_id: input.productId,
    _items: input.items,
    _full_name: input.fullName,
    _phone: input.phone,
    _wilaya_code: input.wilayaCode,
    _commune: input.commune,
    _delivery_type: input.deliveryType,
    _adresse: input.adresse,
    _desk_code: input.deskCode,
  });

  if (error) throw new Error(error.message);
  const orderId = data as string;

  // Fire-and-forget notifications (edge function holds the credentials):
  // Telegram alert + Google Sheet row with status "En attente".
  try {
    await (supabase as any).functions.invoke("send-order-notifications", {
      body: { order_id: orderId, mode: "telegram" },
    });
  } catch {
    /* notification failures must never block the customer */
  }
  try {
    await (supabase as any).functions.invoke("send-order-notifications", {
      body: { order_id: orderId, mode: "sync" },
    });
  } catch {
    /* sheet failures must never block the customer */
  }


  return orderId;
}

export type CartOrderLine = {
  product_id: string;
  color_name: string | null;
  quantity: number;
};

export async function placeCartOrder(input: {
  items: CartOrderLine[];
  fullName: string;
  phone: string;
  wilayaCode: number;
  commune: string;
  deliveryType: "domicile" | "stopdesk";
  adresse: string;
  deskCode?: string;
  couponCode?: string | null;
}) {
  const { data, error } = await rpc("place_cart_order", {
    ...(input.couponCode ? { _coupon_code: input.couponCode } : {}),
    _items: input.items,
    _full_name: input.fullName,
    _phone: input.phone,
    _wilaya_code: input.wilayaCode,
    _commune: input.commune,
    _delivery_type: input.deliveryType,
    _adresse: input.adresse,
    _desk_code: input.deskCode ?? "",
  });
  if (error) throw new Error(error.message);
  const orderId = data as string;

  for (const mode of ["telegram", "sync"]) {
    try {
      await (supabase as any).functions.invoke("send-order-notifications", {
        body: { order_id: orderId, mode },
      });
    } catch {
      /* notification failures must never block the customer */
    }
  }
  return orderId;
}

/** Mirrors public.discounted_unit() in the database. */
export function discountedUnit(
  price: number,
  min: number | null | undefined,
  pct: number | null | undefined,
  qty: number,
  enabled: boolean,
) {
  const p = Number(price) || 0;
  const m = Number(min) || 0;
  const d = Number(pct) || 0;
  if (!enabled || m <= 0 || d <= 0 || d >= 100 || qty < m) return p;
  return Math.round(p * (1 - d / 100));
}

export function hasQtyDiscount(p: { qty_discount_min?: number | null; qty_discount_percent?: number | null }) {
  const m = Number(p.qty_discount_min) || 0;
  const d = Number(p.qty_discount_percent) || 0;
  return m > 0 && d > 0 && d < 100;
}

export function formatDzd(value: number) {
  return `${new Intl.NumberFormat("fr-DZ").format(Math.round(value))} DA`;
}

export type CouponResult = { valid: boolean; code?: string; discount?: number; message?: string };
export async function validateCoupon(code: string, subtotal: number): Promise<CouponResult> {
  const { data, error } = await rpc("validate_coupon", { _code: code, _subtotal: subtotal });
  if (error) throw new Error(error.message);
  return data as CouponResult;
}
