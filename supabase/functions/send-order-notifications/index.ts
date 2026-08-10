import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const order_id = body?.order_id;
    const mode: "telegram" | "sheet" | "status" =
      body?.mode === "sheet" ? "sheet" : body?.mode === "status" ? "status" : "telegram";
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
        .select("telegram_bot_token, telegram_chat_id, site_name, google_sheet_webhook_url")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    if (!order) {
      return new Response(JSON.stringify({ error: "Commande introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Google Sheet status update: fires when an order is marked delivered ---
    if (mode === "status") {
      const sheetUrl = settings?.google_sheet_webhook_url?.trim();
      if (!sheetUrl) {
        return new Response(JSON.stringify({ status_update: "skipped" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const res = await fetch(sheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "archiveOrder",
            phone: order.phone,
            orderId: order.id,
            status: "livré",
            fullName: order.full_name,
            article: order.product_name,
            quantity: order.quantity || 1,
            address: order.adresse ?? "",
            wilaya: order.wilaya_name || order.wilaya_id,
            commune: order.commune,
            totalPrice: order.total,
            note: order.note || "",
          }),
        });
        if (!res.ok) {
          console.error("Google Sheet status webhook error", res.status, await res.text());
          return new Response(JSON.stringify({ status_update: "failed" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ status_update: "sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (statusError) {
        console.error("Google Sheet status webhook failed", statusError);
        return new Response(JSON.stringify({ status_update: "failed" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- Google Sheet: only on admin confirmation, and only once per order ---
    if (mode === "sheet") {
      if (order.sheet_sent_at) {
        return new Response(JSON.stringify({ sheet: "already_sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sheetUrl = settings?.google_sheet_webhook_url?.trim();
      if (!sheetUrl) {
        return new Response(JSON.stringify({ sheet: "skipped" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const res = await fetch(sheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: order.full_name,
            phone: order.phone,
            article: order.product_name,
            quantity: order.quantity || 1,
            address: order.adresse ?? "",
            wilaya: order.wilaya_name || order.wilaya_id,
            commune: order.commune,
            totalPrice: order.total,
            note: order.note || "",
          }),
        });
        if (!res.ok) {
          console.error("Google Sheet webhook error", res.status, await res.text());
          return new Response(JSON.stringify({ sheet: "failed" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await supabase
          .from("orders")
          .update({ sheet_sent_at: new Date().toISOString() })
          .eq("id", order_id)
          .is("sheet_sent_at", null);
        return new Response(JSON.stringify({ sheet: "sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (sheetError) {
        console.error("Google Sheet webhook failed", sheetError);
        return new Response(JSON.stringify({ sheet: "failed" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- Telegram: fires on order creation ---
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
