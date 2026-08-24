import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
      toast.error("Veuillez choisir une wilaya.");
      return;
    }
    if (fullName.trim().length < 3) {
      toast.error("Nom complet requis.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 9) {
      toast.error("Numéro de téléphone invalide.");
      return;
    }
    if (!commune) {
      toast.error("Veuillez choisir une commune.");
      return;
    }
    const address = deliveryType === "domicile" ? adresse : deskAddress;
    if (!address.trim()) {
      toast.error(
        deliveryType === "domicile"
          ? "Adresse de livraison requise."
          : "Veuillez choisir un point Stop Desk.",
      );
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
      toast.success("Commande confirmée ! Nous vous appellerons bientôt.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Une erreur est survenue.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-sm border border-primary/30 bg-accent/50 p-8 text-center">
        <ShieldCheck className="mx-auto size-8 text-primary" />
        <h3 className="mt-4 font-display text-2xl text-foreground">
          Merci, votre commande est confirmée
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Référence : {done.slice(0, 8).toUpperCase()} — notre équipe vous contactera
          pour confirmer la livraison.
        </p>
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
          Commander — Paiement à la livraison
        </h2>
      </div>

      <div className="mt-6 grid min-w-0 gap-5">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="fullName">Nom complet *</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Votre nom et prénom"
            maxLength={120}
            required
            className="h-12 rounded-sm"
          />
        </div>

        <div className="grid min-w-0 gap-2">
          <Label htmlFor="phone">Numéro de téléphone *</Label>
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
          <Label htmlFor="wilaya">Wilaya *</Label>
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
            placeholder="Choisir votre wilaya"
            searchPlaceholder="Rechercher une wilaya..."
          />
        </div>

        <div className="grid min-w-0 gap-2">
          <Label>Mode de livraison *</Label>
          <div className="grid grid-cols-1 gap-2 rounded-sm bg-secondary p-1 sm:grid-cols-2">
            {(
              [
                { key: "domicile", label: "التوصيل للمنزل (À Domicile)" },
                { key: "stopdesk", label: "الاستلام من المكتب (Stopdesk / Bureau)" },
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
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 gap-2">
          <Label htmlFor="commune">Commune *</Label>
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
                  ? "Aucun bureau dans cette wilaya"
                  : "Choisir votre commune"
                : "Choisissez d'abord une wilaya"
            }
            searchPlaceholder="Rechercher une commune..."
            disabled={!code || communeOptions.length === 0}
          />
        </div>

        {deliveryType === "domicile" ? (
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="adresse">Adresse de livraison *</Label>
            <Textarea
              id="adresse"
              value={adresse}
              onChange={(event) => setAdresse(event.target.value)}
              placeholder="Cité, rue, numéro, repère..."
              maxLength={400}
              rows={3}
              className="rounded-sm"
            />
          </div>
        ) : (
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="desk">Point Stop Desk *</Label>
            <Combobox
              id="desk"
              options={deskOptions}
              value={deskAddress}
              onChange={setDeskAddress}
              placeholder={
                commune ? "Choisir le bureau" : "Choisissez d'abord une commune"
              }
              searchPlaceholder="Rechercher un bureau..."
              disabled={!commune || deskOptions.length === 0}
            />
          </div>
        )}

        <div className="grid min-w-0 gap-2">
          <Label htmlFor="quantity">Quantité</Label>
          <Input
            id="quantity"
            type="number"
            min={1}
            max={Math.max(product.stock_quantity, 1)}
            value={quantity}
            onChange={(event) =>
              setQuantity(Math.max(1, Number(event.target.value) || 1))
            }
            className="h-12 w-28 rounded-sm"
          />
        </div>
      </div>

      <div className="mt-7 space-y-2 border-t border-border pt-5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Sous-total</span>
          <span>{formatDzd(subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Livraison</span>
          <span>{rate ? formatDzd(shippingFee) : "—"}</span>
        </div>
        <div className="flex justify-between pt-2 font-display text-2xl text-foreground">
          <span>Total</span>
          <span>{formatDzd(total)}</span>
        </div>
      </div>

      <Button
        type="submit"
        disabled={submitting || product.stock_quantity <= 0}
        className="mt-6 h-14 w-full rounded-sm text-sm uppercase tracking-[0.2em]"
      >
        {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        {product.stock_quantity <= 0
          ? "Produit épuisé"
          : "Confirmer la Commande — تأكيد الطلب"}
      </Button>
    </form>
  );
}
