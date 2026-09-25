import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const order_id = body?.order_id;
    const rawMode = body?.mode;
    const mode: string = typeof rawMode === "string" ? rawMode : "telegram";


    if (!order_id || typeof order_id !== "string") {
      return json({ error: "order_id requis" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const [{ data: order }, { data: settings }] = await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(color_name, quantity, product_name, unit_price)")
        .eq("id", order_id)
        .maybeSingle(),
      supabase
        .from("app_settings")
        .select("telegram_bot_token, telegram_chat_id, site_name, google_sheet_webhook_url")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    if (!order) return json({ error: "Commande introuvable" }, 404);

    const items: Array<{
      color_name: string | null;
      quantity: number;
      product_name?: string | null;
      unit_price?: number | null;
    }> = order.order_items ?? [];
    const isCart = !order.product_id && items.some((item) => item.product_name);
    const cartSummary = items
      .map(
        (item) =>
          `${item.quantity}x ${item.product_name ?? "Produit"}${item.color_name ? ` (${item.color_name})` : ""}`,
      )
      .join(", ");
    const colorSummary = items
      .filter((item) => item.color_name)
      .map((item) => `${item.quantity}x ${item.color_name}`)
      .join(", ");

    const isStopdesk = order.delivery_type === "stopdesk";
    const stopdeskCode = isStopdesk ? order.desk_code || "" : "";


    const buildPayload = (status: string) => ({
      nom_complet: order.full_name,
      telephone: order.phone,
      article: isCart
        ? cartSummary
        : colorSummary
          ? `${order.product_name} (${colorSummary})`
          : order.product_name,
      quantite: order.quantity || 1,
      adresse: isStopdesk ? stopdeskCode : order.adresse || "",
      wilaya: order.wilaya_name || order.wilaya_id,
      commune: order.commune,
      total_a_ramasser: order.total,
      id_externe: order.id,
      oui_pour_echange: order.is_exchange ? "OUI" : "NON",
      stopdesk_code: stopdeskCode,
      ref_article: order.product_ref || "",
      note: order.note || "",
      status,
    });

    const sheetUrl = settings?.google_sheet_webhook_url?.trim();

    async function postSheet(payload: Record<string, unknown>) {
      const res = await fetch(sheetUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Sheet webhook ${res.status}: ${text}`);
      }
      return res;
    }

    const STATUS_LABELS: Record<string, string> = {
      pending: "En attente",
      confirmed: "Confirmée",
      shipped: "Expédiée",
      delivered: "Livrée",
      cancelled: "Annulée",
    };

    const ACTION_BY_STATUS: Record<string, string> = {
      pending: "addOrder",
      confirmed: "addOrder",
      shipped: "updateStatus",
      delivered: "archiveOrder",
      cancelled: "cancelOrder",
    };

    // --- Sheet sync: fires on order creation and on every status change ---
    if (mode === "sheet" || mode === "status" || mode === "cancel" || mode === "sync") {
      if (!sheetUrl) return json({ sheet: "skipped", status_update: "skipped", cancel: "skipped" });

      const statusKey = String(order.status ?? "pending");
      const label = STATUS_LABELS[statusKey] ?? "En attente";
      let action = ACTION_BY_STATUS[statusKey] ?? "updateStatus";
      // Never append the same order twice into "Commande"
      if (action === "addOrder" && order.sheet_sent_at) action = "updateStatus";

      try {
        await postSheet({ action, ...buildPayload(label) });
        if (action === "addOrder") {
          await supabase
            .from("orders")
            .update({ sheet_sent_at: new Date().toISOString() })
            .eq("id", order_id)
            .is("sheet_sent_at", null);
        }
        return json({ sheet: "sent", action, status: label });
      } catch (error) {
        console.error("Google Sheet webhook failed", action, error);
        return json({ sheet: "failed", action, status: label }, 502);
      }
    }


    // --- Telegram: fires on order creation (supports multiple chat IDs) ---
    const token = settings?.telegram_bot_token;
    const chatIds = String(settings?.telegram_chat_id ?? "")
      .split(",")
      .map((id: string) => id.trim())
      .filter(Boolean);

    if (!token || chatIds.length === 0) {
      return json({ skipped: "telegram non configuré" });
    }

    const lines = [
      `🛍️ <b>Nouvelle commande — ${settings?.site_name ?? "Glamour Touch"}</b>`,
      "",
      isCart
        ? `<b>Panier:</b> ${order.quantity} article(s)`
        : `<b>Produit:</b> ${order.product_name} × ${order.quantity}`,
      ...(isCart
        ? items.map(
            (item) =>
              `   • ${item.product_name ?? "Produit"}${item.color_name ? ` — ${item.color_name}` : ""} × ${item.quantity}${item.unit_price != null ? ` (${item.unit_price} DA)` : ""}`,
          )
        : items.length > 0
          ? items.map(
              (item) =>
                `   • ${item.color_name ?? "Standard"} × ${item.quantity}`,
            )
          : []),
      `<b>Client:</b> ${order.full_name}`,
      `<b>Téléphone:</b> ${order.phone}`,
      `<b>Wilaya:</b> ${order.wilaya_name}`,
      `<b>Commune:</b> ${order.commune}`,
      `<b>Livraison:</b> ${isStopdesk ? "Stopdesk" : "À domicile"}`,
      order.adresse ? `<b>Adresse:</b> ${order.adresse}` : "",
      `<b>Frais:</b> ${order.shipping_fee} DA`,
      `<b>Total:</b> ${order.total} DA`,
    ].filter(Boolean);

    const results = await Promise.all(
      chatIds.map(async (chatId: string) => {
        try {
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
            console.error("Telegram error", chatId, response.status, JSON.stringify(result));
            return { chat_id: chatId, ok: false };
          }
          return { chat_id: chatId, ok: true };
        } catch (error) {
          console.error("Telegram send failed", chatId, error);
          return { chat_id: chatId, ok: false };
        }
      }),
    );

    return json({ ok: results.some((r) => r.ok), results });
  } catch (error) {
    console.error(error);
    return json({ error: String(error) }, 500);
  }
});
