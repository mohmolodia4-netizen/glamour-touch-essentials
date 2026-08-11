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
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  status: string;
  sort_order: number;
};

export type ShippingRate = {
  wilaya_code: number;
  wilaya_name: string;
  domicile_fee: number;
  stopdesk_fee: number;
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
  phone: string | null;
  whatsapp: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  meta_pixel_id: string | null;
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
      await table("shipping_rates").select("*").order("wilaya_code"),
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

export async function placeOrder(input: {
  productId: string;
  quantity: number;
  fullName: string;
  phone: string;
  wilayaCode: number;
  commune: string;
  deliveryType: "domicile" | "stopdesk";
  adresse: string;
  deskCode?: string;
}) {
  const { data, error } = await rpc("place_order", {
    _product_id: input.productId,
    _quantity: input.quantity,
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

export function formatDzd(value: number) {
  return `${new Intl.NumberFormat("fr-DZ").format(Math.round(value))} DA`;
}
