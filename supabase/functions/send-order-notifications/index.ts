import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { order_id } = await req.json();
    if (!order_id || typeof order_id !== "string") {
      return new Response(JSON.stringify({ error: "order_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const [{ data: order }, { data: settings }] = await Promise.all([
      supabase.from("orders").select("*").eq("id", order_id).maybeSingle(),
      supabase
        .from("app_settings")
        .select("telegram_bot_token, telegram_chat_id, site_name")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    if (!order) {
      return new Response(JSON.stringify({ error: "Commande introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = settings?.telegram_bot_token;
    const chatId = settings?.telegram_chat_id;
    if (!token || !chatId) {
      return new Response(JSON.stringify({ skipped: "telegram non configuré" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lines = [
      `🛍️ <b>Nouvelle commande — ${settings?.site_name ?? "Glamour Touch"}</b>`,
      "",
      `<b>Produit:</b> ${order.product_name} × ${order.quantity}`,
      `<b>Client:</b> ${order.full_name}`,
      `<b>Téléphone:</b> ${order.phone}`,
      `<b>Wilaya:</b> ${order.wilaya_name}`,
      `<b>Commune:</b> ${order.commune}`,
      `<b>Livraison:</b> ${order.delivery_type === "domicile" ? "À domicile" : "Stopdesk"}`,
      order.adresse ? `<b>Adresse:</b> ${order.adresse}` : "",
      `<b>Frais:</b> ${order.shipping_fee} DA`,
      `<b>Total:</b> ${order.total} DA`,
    ].filter(Boolean);

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
      }),
    });

    const result = await response.json();
    if (!response.ok || result.ok === false) {
      console.error("Telegram error", response.status, JSON.stringify(result));
      return new Response(JSON.stringify({ error: result }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
