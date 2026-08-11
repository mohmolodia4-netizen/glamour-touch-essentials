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
    const mode: "telegram" | "sheet" | "status" | "cancel" =
      rawMode === "sheet"
        ? "sheet"
        : rawMode === "status"
          ? "status"
          : rawMode === "cancel"
            ? "cancel"
            : "telegram";

    if (!order_id || typeof order_id !== "string") {
      return json({ error: "order_id requis" }, 400);
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

    if (!order) return json({ error: "Commande introuvable" }, 404);

    const isStopdesk = order.delivery_type === "stopdesk";
    const stopdeskCode = isStopdesk ? order.desk_code || "" : "";

    const buildPayload = (status: string) => ({
      nom_complet: order.full_name,
      telephone: order.phone,
      article: order.product_name,
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

    // --- Livré: move to "Archives" ---
    if (mode === "status") {
      if (!sheetUrl) return json({ status_update: "skipped" });
      try {
        await postSheet({ action: "archiveOrder", ...buildPayload("Livré") });
        return json({ status_update: "sent" });
      } catch (error) {
        console.error("Google Sheet archive webhook failed", error);
        return json({ status_update: "failed" }, 502);
      }
    }

    // --- Annulée: move to "annulée" ---
    if (mode === "cancel") {
      if (!sheetUrl) return json({ cancel: "skipped" });
      try {
        await postSheet({ action: "cancelOrder", ...buildPayload("annulée") });
        return json({ cancel: "sent" });
      } catch (error) {
        console.error("Google Sheet cancel webhook failed", error);
        return json({ cancel: "failed" }, 502);
      }
    }

    // --- Confirmé: append to "Commande", once per order ---
    if (mode === "sheet") {
      if (order.sheet_sent_at) return json({ sheet: "already_sent" });
      if (!sheetUrl) return json({ sheet: "skipped" });
      try {
        await postSheet({ action: "addOrder", ...buildPayload("Confirmé") });
        await supabase
          .from("orders")
          .update({ sheet_sent_at: new Date().toISOString() })
          .eq("id", order_id)
          .is("sheet_sent_at", null);
        return json({ sheet: "sent" });
      } catch (error) {
        console.error("Google Sheet webhook failed", error);
        return json({ sheet: "failed" }, 502);
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
      `<b>Produit:</b> ${order.product_name} × ${order.quantity}`,
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
