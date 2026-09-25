import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Truck } from "lucide-react";

import { CartLines } from "@/components/cart/CartDrawer";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import {
  communesQuery,
  formatDzd,
  placeCartOrder,
  shippingRatesQuery,
  stopdesksQuery,
} from "@/lib/store";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Mon panier — Glamour Touch" },
      { name: "description", content: "Finalisez votre commande Glamour Touch, paiement à la livraison." },
      { property: "og:title", content: "Mon panier — Glamour Touch" },
      { property: "og:description", content: "Paiement à la livraison dans les 58 wilayas." },
    ],
  }),
  component: CheckoutPage,
});

type DeliveryType = "domicile" | "stopdesk";

function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilayaCode, setWilayaCode] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("domicile");
  const [commune, setCommune] = useState("");
  const [adresse, setAdresse] = useState("");
  const [deskAddress, setDeskAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const code = wilayaCode ? Number(wilayaCode) : null;
  const { data: rates = [] } = useQuery(shippingRatesQuery());
  const { data: communes = [] } = useQuery(communesQuery(code));
  const { data: stopdesks = [] } = useQuery(stopdesksQuery(code));

  const deskCode = useMemo(
    () =>
      stopdesks.find((d) => d.commune_name === commune && d.address === deskAddress)
        ?.desk_code ?? "",
    [stopdesks, commune, deskAddress],
  );

  const rate = rates.find((r) => r.wilaya_code === code) ?? null;
  const shippingFee = rate ? (deliveryType === "domicile" ? rate.domicile_fee : rate.stopdesk_fee) : 0;
  const total = subtotal + shippingFee;

  const wilayaOptions = useMemo(
    () =>
      rates.map((r) => ({
        value: String(r.wilaya_code),
        label: `${String(r.wilaya_code).padStart(2, "0")} — ${r.wilaya_name}`,
      })),
    [rates],
  );
  const communeOptions = useMemo(() => {
    if (deliveryType === "domicile")
      return communes.map((c) => ({ value: c.commune_name, label: c.commune_name, hint: c.postal_code ?? "" }));
    const names = Array.from(new Set(stopdesks.map((d) => d.commune_name))).sort((a, b) => a.localeCompare(b, "fr"));
    return names.map((n) => ({ value: n, label: n }));
  }, [communes, stopdesks, deliveryType]);
  const deskOptions = useMemo(
    () =>
      stopdesks
        .filter((d) => d.commune_name === commune)
        .map((d) => ({ value: d.address, label: `${d.desk_name} — ${d.address}` })),
    [stopdesks, commune],
  );

  useEffect(() => {
    setCommune("");
    setDeskAddress("");
  }, [wilayaCode, deliveryType]);

  async function handleSubmit(e: React.FormEvent): Promise<unknown> {
    e.preventDefault();
    if (items.length === 0) return toast.error("Votre panier est vide.");
    if (!code) return toast.error("Veuillez choisir une wilaya.");
    if (fullName.trim().length < 3) return toast.error("Nom complet requis.");
    if (phone.replace(/\D/g, "").length < 9) return toast.error("Numéro de téléphone invalide.");
    if (!commune) return toast.error("Veuillez choisir une commune.");
    const address = deliveryType === "domicile" ? adresse : deskAddress;
    if (!address.trim())
      return toast.error(deliveryType === "domicile" ? "Adresse de livraison requise." : "Veuillez choisir un point Stop Desk.");

    setSubmitting(true);
    try {
      const id = await placeCartOrder({
        items: items.map((i) => ({ product_id: i.product_id, color_name: i.color_name, quantity: i.quantity })),
        fullName,
        phone,
        wilayaCode: code,
        commune,
        deliveryType,
        adresse: address,
        deskCode,
      });
      clearCart();
      setDone(id);
      toast.success("Commande confirmée ! Nous vous appellerons bientôt.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
    return undefined;
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-10">
        {done ? (
          <div className="mx-auto max-w-lg rounded-sm border border-primary/30 bg-accent/50 p-8 text-center">
            <ShieldCheck className="mx-auto size-8 text-primary" />
            <h1 className="mt-4 font-display text-2xl">Merci, votre commande est confirmée</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Référence : {done.slice(0, 8).toUpperCase()} — notre équipe vous contactera.
            </p>
            <Button asChild variant="outline" className="mt-6 rounded-sm">
              <Link to="/boutique">Continuer mes achats</Link>
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center">
            <h1 className="font-display text-3xl">Votre panier est vide</h1>
            <Button asChild variant="outline" className="mt-6 rounded-sm">
              <Link to="/boutique">Découvrir la boutique</Link>
            </Button>
          </div>
        ) : (
          <div className="grid w-full gap-10 lg:grid-cols-2">
            <section className="min-w-0">
              <h1 className="font-display text-3xl">Mon panier</h1>
              <CartLines />
            </section>
            <form onSubmit={handleSubmit} className="w-full min-w-0 rounded-sm border border-border bg-card p-6 shadow-soft sm:p-8">
              <div className="flex items-center gap-2 border-b border-border pb-5">
                <Truck className="size-4 text-primary" />
                <h2 className="font-display text-2xl">Paiement à la livraison</h2>
              </div>
              <div className="mt-6 grid min-w-0 gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="fullName">Nom complet *</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} className="h-12 rounded-sm" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Numéro de téléphone *</Label>
                  <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05 00 00 00 00" maxLength={20} className="h-12 rounded-sm" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="wilaya">Wilaya *</Label>
                  <Combobox id="wilaya" options={wilayaOptions} value={wilayaCode} onChange={setWilayaCode} placeholder="Choisir votre wilaya" searchPlaceholder="Rechercher une wilaya..." />
                </div>
                <div className="grid gap-2">
                  <Label>Mode de livraison *</Label>
                  <div className="grid grid-cols-1 gap-2 rounded-sm bg-secondary p-1 sm:grid-cols-2">
                    {([
                      { key: "domicile", label: "التوصيل للمنزل (À Domicile)" },
                      { key: "stopdesk", label: "الاستلام من المكتب (Stopdesk)" },
                    ] as const).map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setDeliveryType(o.key)}
                        className={cn(
                          "rounded-sm px-3 py-3 text-xs transition-colors",
                          deliveryType === o.key ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="commune">Commune *</Label>
                  <Combobox
                    id="commune"
                    options={communeOptions}
                    value={commune}
                    onChange={(v) => {
                      setCommune(v);
                      setDeskAddress("");
                    }}
                    placeholder={code ? "Choisir votre commune" : "Choisissez d'abord une wilaya"}
                    searchPlaceholder="Rechercher une commune..."
                    disabled={!code || communeOptions.length === 0}
                  />
                </div>
                {deliveryType === "domicile" ? (
                  <div className="grid gap-2">
                    <Label htmlFor="adresse">Adresse de livraison *</Label>
                    <Textarea id="adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} maxLength={400} rows={3} className="rounded-sm" />
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="desk">Point Stop Desk *</Label>
                    <Combobox
                      id="desk"
                      options={deskOptions}
                      value={deskAddress}
                      onChange={setDeskAddress}
                      placeholder={commune ? "Choisir le bureau" : "Choisissez d'abord une commune"}
                      searchPlaceholder="Rechercher un bureau..."
                      disabled={!commune || deskOptions.length === 0}
                    />
                  </div>
                )}
              </div>
              <div className="mt-7 space-y-2 border-t border-border pt-5 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Sous-total</span><span>{formatDzd(subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Livraison</span><span>{rate ? formatDzd(shippingFee) : "—"}</span></div>
                <div className="flex justify-between pt-2 font-display text-2xl"><span>Total</span><span>{formatDzd(total)}</span></div>
              </div>
              <Button type="submit" disabled={submitting} className="mt-6 h-14 w-full rounded-sm text-sm uppercase tracking-[0.2em]">
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Confirmer la Commande — تأكيد الطلب
              </Button>
            </form>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
