import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, ShieldCheck, Truck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { WhatsAppConfirm } from "@/components/checkout/WhatsAppConfirm";
import { trackPixel } from "@/lib/pixel";
import { trackTiktok } from "@/lib/tiktok-pixel";
import {
  communesQuery,
  formatDzd,
  placeOrder,
  productVariantsQuery,
  shippingRatesQuery,
  stopdesksQuery,
  type Product,
} from "@/lib/store";
import { useI18n } from "@/lib/i18n";

type DeliveryType = "domicile" | "stopdesk";
type Line = { color: string; quantity: number };

export function OrderForm({ product }: { product: Product }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilayaCode, setWilayaCode] = useState<string>("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("domicile");
  const [commune, setCommune] = useState("");
  const [adresse, setAdresse] = useState("");
  const [deskAddress, setDeskAddress] = useState("");
  const [deskCode, setDeskCode] = useState("");
  const [lines, setLines] = useState<Line[]>([{ color: "", quantity: 1 }]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [startedCheckout, setStartedCheckout] = useState(false);
  const { t } = useI18n();

  const code = wilayaCode ? Number(wilayaCode) : null;
  const { data: rates = [] } = useQuery(shippingRatesQuery());
  const { data: communes = [] } = useQuery(communesQuery(code));
  const { data: stopdesks = [] } = useQuery(stopdesksQuery(code));
  const { data: variants = [] } = useQuery(productVariantsQuery(product.id));

  const hasVariants = variants.length > 0;
  const availableVariants = useMemo(
    () => variants.filter((variant) => variant.stock_quantity > 0),
    [variants],
  );

  useEffect(() => {
    const first = availableVariants[0];
    if (!hasVariants || !first) return;
    setLines((current) =>
      current.map((line) =>
        line.color ? line : { ...line, color: first.color_name },
      ),
    );
  }, [hasVariants, availableVariants]);


  useEffect(() => {
    const desk = stopdesks.find(
      (d) => d.commune_name === commune && d.address === deskAddress,
    );
    setDeskCode(desk?.desk_code ?? "");
  }, [stopdesks, commune, deskAddress]);

  const rate = rates.find((item) => item.wilaya_code === code) ?? null;
  const shippingFee = rate
    ? deliveryType === "domicile"
      ? rate.domicile_fee
      : rate.stopdesk_fee
    : 0;
  const quantity = lines.reduce((sum, line) => sum + Math.max(1, line.quantity), 0);
  const subtotal = Number(product.price) * quantity;
  const total = subtotal + shippingFee;

  const maxStock = hasVariants
    ? variants.reduce((sum, variant) => sum + variant.stock_quantity, 0)
    : product.stock_quantity;


  const wilayaOptions = useMemo(
    () =>
      rates.map((item) => ({
        value: String(item.wilaya_code),
        label: `${String(item.wilaya_code).padStart(2, "0")} — ${item.wilaya_name}`,
      })),
    [rates],
  );

  const stopdeskCommunes = useMemo(() => {
    const names = Array.from(new Set(stopdesks.map((desk) => desk.commune_name)));
    names.sort((a, b) => a.localeCompare(b, "fr"));
    return names.map((name) => ({ value: name, label: name }));
  }, [stopdesks]);

  const communeOptions = useMemo(
    () =>
      deliveryType === "domicile"
        ? communes.map((item) => ({
            value: item.commune_name,
            label: item.commune_name,
            hint: item.postal_code ?? "",
          }))
        : stopdeskCommunes,
    [communes, deliveryType, stopdeskCommunes],
  );

  const deskOptions = useMemo(
    () =>
      stopdesks
        .filter((desk) => desk.commune_name === commune)
        .map((desk) => ({
          value: desk.address,
          label: `${desk.desk_name} — ${desk.address}`,
        })),
    [stopdesks, commune],
  );

  function touchCheckout() {
    if (startedCheckout) return;
    setStartedCheckout(true);
    trackPixel("InitiateCheckout", {
      content_ids: [product.id],
      content_name: product.name,
      value: Number(product.price),
      currency: "DZD",
    });
  }

  function switchDelivery(next: DeliveryType) {
    setDeliveryType(next);
    setCommune("");
    setAdresse("");
    setDeskAddress("");
    touchCheckout();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!code) {
      toast.error(t("err.wilaya"));
      return;
    }
    if (fullName.trim().length < 3) {
      toast.error(t("err.name"));
      return;
    }
    if (phone.replace(/\D/g, "").length < 9) {
      toast.error(t("err.phone"));
      return;
    }
    if (!commune) {
      toast.error(t("err.commune"));
      return;
    }
    const address = deliveryType === "domicile" ? adresse : deskAddress;
    if (!address.trim()) {
      toast.error(
        deliveryType === "domicile"
          ? t("err.address")
          : t("err.desk"),
      );
      return;
    }
    if (hasVariants && lines.some((line) => !line.color)) {
      toast.error(t("err.colorEach"));
      return;
    }


    setSubmitting(true);
    try {
      const orderId = await placeOrder({
        productId: product.id,
        items: lines.map((line) => ({
          color_name: hasVariants ? line.color : null,
          quantity: Math.max(1, line.quantity),
        })),

        fullName,
        phone,
        wilayaCode: code,
        commune,
        deliveryType,
        adresse: address,
        deskCode,
      });
      trackPixel("Purchase", {
        content_ids: [product.id],
        content_name: product.name,
        value: total,
        currency: "DZD",
      });
      const ttPayload = {
        content_type: "product",
        content_id: product.id,
        content_name: product.name || "Order",
        quantity,
        price: Number(product.price) || 0,
        contents: [
          {
            content_id: product.id,
            content_type: "product",
            content_name: product.name || "Order",
            quantity,
            price: Number(product.price) || 0,
          },
        ],
        value: Number(total) || 0,
        currency: "DZD",
      };
      trackTiktok("CompletePayment", ttPayload);
      trackTiktok("PlaceAnOrder", ttPayload);
      setDone(orderId);
      toast.success(t("ok.order"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("err.generic"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const wilayaName = rate
      ? `${String(code).padStart(2, "0")} — ${rate.wilaya_name}`
      : wilayaCode;
    return (
      <div className="rounded-sm border border-primary/30 bg-accent/50 p-8 text-center">
        <ShieldCheck className="mx-auto size-8 text-primary" />
        <h3 className="mt-4 font-display text-2xl text-foreground">
          {t("done.title")}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("done.ref", { ref: done.slice(0, 8).toUpperCase() })}
        </p>
        <WhatsAppConfirm
          orderId={done}
          fullName={fullName}
          lines={lines.map((line) => ({
            name: product.name,
            color: hasVariants ? line.color : null,
            quantity: Math.max(1, line.quantity),
          }))}
          total={total}
          wilaya={wilayaName}
          commune={commune}
        />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onFocus={touchCheckout}
      className="w-full min-w-0 rounded-sm border border-border bg-card p-6 shadow-soft sm:p-8"
    >
      <div className="flex items-center gap-2 border-b border-border pb-5">
        <Truck className="size-4 text-primary" />
        <h2 className="font-display text-2xl text-foreground">
          {t("form.title")}
        </h2>
      </div>

      <div className="mt-6 grid min-w-0 gap-5">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="fullName">{t("form.fullName")}</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder={t("form.fullNamePh")}
            maxLength={120}
            required
            className="h-12 rounded-sm"
          />
        </div>

        <div className="grid min-w-0 gap-2">
          <Label htmlFor="phone">{t("form.phone")}</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="05 00 00 00 00"
            maxLength={20}
            required
            className="h-12 rounded-sm"
          />
        </div>

        <div className="grid min-w-0 gap-2">
          <Label htmlFor="wilaya">{t("form.wilaya")}</Label>
          <Combobox
            id="wilaya"
            options={wilayaOptions}
            value={wilayaCode}
            onChange={(value) => {
              setWilayaCode(value);
              setCommune("");
              setDeskAddress("");
              touchCheckout();
            }}
            placeholder={t("form.wilayaPh")}
            searchPlaceholder={t("form.wilayaSearch")}
          />
        </div>

        <div className="grid min-w-0 gap-2">
          <Label>{t("form.delivery")}</Label>
          <div className="grid grid-cols-1 gap-2 rounded-sm bg-secondary p-1 sm:grid-cols-2">
            {(
              [
                { key: "domicile", label: "form.domicile" },
                { key: "stopdesk", label: "form.stopdesk" },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => switchDelivery(option.key)}
                className={cn(
                  "min-w-0 break-words rounded-sm px-4 py-3 text-sm transition-colors",
                  deliveryType === option.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-card",
                )}
              >
                {t(option.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 gap-2">
          <Label htmlFor="commune">{t("form.commune")}</Label>
          <Combobox
            id="commune"
            options={communeOptions}
            value={commune}
            onChange={(value) => {
              setCommune(value);
              setDeskAddress("");
            }}
            placeholder={
              code
                ? deliveryType === "stopdesk" && communeOptions.length === 0
                  ? t("form.noDesk")
                  : t("form.communePh")
                : t("form.wilayaFirst")
            }
            searchPlaceholder={t("form.communeSearch")}
            disabled={!code || communeOptions.length === 0}
          />
        </div>

        {deliveryType === "domicile" ? (
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="adresse">{t("form.address")}</Label>
            <Textarea
              id="adresse"
              value={adresse}
              onChange={(event) => setAdresse(event.target.value)}
              placeholder={t("form.addressPh")}
              maxLength={400}
              rows={3}
              className="rounded-sm"
            />
          </div>
        ) : (
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="desk">{t("form.desk")}</Label>
            <Combobox
              id="desk"
              options={deskOptions}
              value={deskAddress}
              onChange={setDeskAddress}
              placeholder={
                commune ? t("form.deskPh") : t("form.communeFirst")
              }
              searchPlaceholder={t("form.deskSearch")}
              disabled={!commune || deskOptions.length === 0}
            />
          </div>
        )}

        <div className="grid min-w-0 gap-3">
          <Label>{t(hasVariants ? "form.quantityColors" : "form.quantity")}</Label>
          {hasVariants ? (
            <div className="grid gap-3">
              {lines.map((line, position) => {
                const selected = variants.find((v) => v.color_name === line.color);
                return (
                  <div
                    key={position}
                    className="flex min-w-0 flex-wrap items-center gap-3 rounded-sm border border-border p-3"
                  >
                    {selected ? (
                      <span
                        aria-hidden
                        className="size-6 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: selected.color_hex }}
                      />
                    ) : null}
                    <select
                      aria-label={t("form.color")}
                      value={line.color}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((item, index) =>
                            index === position
                              ? { ...item, color: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="h-11 min-w-0 flex-1 rounded-sm border border-border bg-background px-3 text-sm"
                    >
                      {variants.map((variant) => (
                        <option
                          key={variant.id}
                          value={variant.color_name}
                          disabled={variant.stock_quantity <= 0}
                        >
                          {variant.color_name}
                          {variant.stock_quantity <= 0 ? t("product.soldOutSuffix") : ""}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      aria-label={t("form.quantity")}
                      min={1}
                      max={Math.max(selected?.stock_quantity ?? 1, 1)}
                      value={line.quantity}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((item, index) =>
                            index === position
                              ? {
                                  ...item,
                                  quantity: Math.max(
                                    1,
                                    Number(event.target.value) || 1,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                      className="h-11 w-24 rounded-sm"
                    />
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        aria-label={t("form.removeLine")}
                        onClick={() =>
                          setLines((current) =>
                            current.filter((_, index) => index !== position),
                          )
                        }
                        className="rounded-sm p-2 text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                className="w-fit rounded-sm"
                disabled={availableVariants.length === 0}
                onClick={() =>
                  setLines((current) => [
                    ...current,
                    { color: availableVariants[0]?.color_name ?? "", quantity: 1 },
                  ])
                }
              >
                <Plus className="me-2 size-4" /> {t("form.addColor")}
              </Button>
            </div>
          ) : (
            <Input
              id="quantity"
              type="number"
              min={1}
              max={Math.max(product.stock_quantity, 1)}
              value={lines[0]?.quantity ?? 1}
              onChange={(event) =>
                setLines([
                  { color: "", quantity: Math.max(1, Number(event.target.value) || 1) },
                ])
              }
              className="h-12 w-28 rounded-sm"
            />
          )}
        </div>

      </div>

      <div className="mt-7 space-y-2 border-t border-border pt-5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>{t("form.subtotal")}</span>
          <span>{formatDzd(subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{t("form.shipping")}</span>
          <span>{rate ? formatDzd(shippingFee) : "—"}</span>
        </div>
        <div className="flex justify-between pt-2 font-display text-2xl text-foreground">
          <span>{t("form.total")}</span>
          <span>{formatDzd(total)}</span>
        </div>
      </div>

      <Button
        type="submit"
        disabled={submitting || maxStock <= 0}
        className="mt-6 h-14 w-full rounded-sm text-sm uppercase tracking-[0.2em]"
      >
        {submitting ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
        {maxStock <= 0 ? t("form.soldOut") : t("form.submit")}
      </Button>

    </form>
  );
}
