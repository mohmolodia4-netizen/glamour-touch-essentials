import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFeature } from "@/lib/features";
import { useI18n } from "@/lib/i18n";
import { formatDzd, publicSettingsQuery } from "@/lib/store";

export type WhatsAppOrderLine = {
  name: string;
  color: string | null;
  quantity: number;
};

export function WhatsAppConfirm({
  orderId,
  fullName,
  lines,
  total,
  wilaya,
  commune,
}: {
  orderId: string;
  fullName: string;
  lines: WhatsAppOrderLine[];
  total: number;
  wilaya: string;
  commune: string;
}) {
  const enabled = useFeature("whatsapp_confirm", false);
  const { data: settings } = useQuery(publicSettingsQuery());
  const { t } = useI18n();

  const digits = (settings?.whatsapp ?? "").replace(/\D/g, "");
  if (!enabled || !digits) return null;

  const message = [
    t("wa.greeting"),
    `${t("wa.order")}: ${orderId.slice(0, 8).toUpperCase()}`,
    `${t("wa.name")}: ${fullName}`,
    `${t("wa.items")}:`,
    ...lines.map(
      (line) =>
        `- ${line.name}${line.color ? ` (${line.color})` : ""} x${line.quantity}`,
    ),
    `${t("wa.total")}: ${formatDzd(total)}`,
    `${t("wa.wilaya")}: ${wilaya}`,
    `${t("wa.commune")}: ${commune}`,
  ].join("\n");

  const href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  return (
    <Button asChild className="mt-6 w-full rounded-sm">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="me-2 size-4" />
        {t("wa.confirm")}
      </a>
    </Button>
  );
}
