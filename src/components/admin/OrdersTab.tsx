import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, MessageCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatDzd } from "@/lib/store";

type Order = {
  id: string;
  created_at: string;
  product_name: string;
  quantity: number;
  full_name: string;
  phone: string;
  wilaya_name: string;
  commune: string;
  adresse: string | null;
  delivery_type: string;
  shipping_fee: number;
  total: number;
  status: string;
};

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export function OrdersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Order[];
    },
  });

  const visible = orders.filter((order) => {
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      [order.full_name, order.phone, order.product_name, order.wilaya_name, order.commune]
        .join(" ")
        .toLowerCase()
        .includes(term);
    return matchesStatus && matchesSearch;
  });

  async function updateStatus(id: string, status: string) {
    const { error } = await (supabase as any)
      .from("orders")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Statut mis à jour");

    try {
      const { data, error: fnError } = await (supabase as any).functions.invoke(
        "send-order-notifications",
        { body: { order_id: id, mode: "sync" } },
      );
      if (fnError) throw fnError;
      if (data?.sheet === "sent") toast.success("Google Sheet mis à jour");
      else if (data?.sheet === "skipped")
        toast.info("Aucune URL Google Sheet configurée");
      else if (data?.sheet === "failed")
        toast.error("Échec de la mise à jour du Google Sheet");
    } catch {
      toast.error("Échec de la mise à jour du Google Sheet");
    }




    void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
  }

  async function remove(id: string) {
    const { error } = await (supabase as any).from("orders").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Commande supprimée");
    void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
  }


  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher (nom, téléphone, produit...)"
          className="h-11 rounded-sm sm:max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 rounded-sm sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune commande.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((order) => (
            <div
              key={order.id}
              className="rounded-sm border border-border bg-card p-4 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {order.full_name} — {order.phone}
                  </p>
                  <p className="text-muted-foreground">
                    {order.product_name} × {order.quantity} ·{" "}
                    {order.delivery_type === "domicile" ? "À domicile" : "Stopdesk"}
                  </p>
                  <p className="text-muted-foreground">
                    {order.wilaya_name} / {order.commune}
                    {order.adresse ? ` — ${order.adresse}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Livraison {formatDzd(Number(order.shipping_fee))} ·{" "}
                    {new Date(order.created_at).toLocaleString("fr-DZ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl text-primary">
                    {formatDzd(Number(order.total))}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Select
                  value={order.status}
                  onValueChange={(value) => updateStatus(order.id, value)}
                >
                  <SelectTrigger className="h-9 w-44 rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(order.phone);
                    toast.success("Numéro copié");
                  }}
                >
                  <Copy className="mr-1 size-3.5" /> Copier
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-sm">
                  <a
                    href={`https://wa.me/${order.phone.replace(/\D/g, "").replace(/^0/, "213")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="mr-1 size-3.5" /> WhatsApp
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-sm text-destructive"
                  onClick={() => remove(order.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
