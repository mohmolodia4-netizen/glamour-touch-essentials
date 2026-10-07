import { useForceFrench } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AdminSidebar, type AdminTab } from "@/components/admin/AdminSidebar";
import { CategoriesTab } from "@/components/admin/CategoriesTab";
import { OrdersTab } from "@/components/admin/OrdersTab";
import { ProductsTab } from "@/components/admin/ProductsTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";
import { publicSettingsQuery } from "@/lib/store";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const ADMIN_TABS: AdminTab[] = ["orders", "products", "categories", "settings"];

const PAGE_COPY: Record<AdminTab, { title: string; subtitle: string }> = {
  orders: { title: "Commandes", subtitle: "Suivez, filtrez et traitez les commandes clients." },
  products: { title: "Produits", subtitle: "Gérez le catalogue, les couleurs, les stocks et les prix." },
  categories: { title: "Catégories", subtitle: "Organisez les collections présentées dans la boutique." },
  settings: { title: "Paramètres", subtitle: "Personnalisez la boutique et ses intégrations." },
};

export const Route = createFileRoute("/admin")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    tab: AdminTab;
    range?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
  } => {
    const str = (value: unknown) =>
      typeof value === "string" && value.length > 0 ? value : undefined;
    return {
      tab: ADMIN_TABS.includes(search["tab"] as AdminTab) ? (search["tab"] as AdminTab) : "orders",
      range: str(search["range"]),
      from: str(search["from"]),
      to: str(search["to"]),
    };
  },
  head: () => ({
    meta: [
      { title: "Administration — Glamour Touch" },
      { name: "description", content: "Espace d'administration de la boutique Glamour Touch." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Administration — Glamour Touch" },
      { property: "og:description", content: "Espace d'administration de la boutique Glamour Touch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function LoginCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/admin` },
          });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (mode === "signup") toast.success("Compte créé. Vérifiez votre email si demandé.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-sm border border-border bg-card p-8"
      >
        <h1 className="font-display text-2xl">Administration</h1>
        <div className="grid gap-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="rounded-sm"
          />
        </div>
        <div className="grid gap-2">
          <Label>Mot de passe</Label>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            className="rounded-sm"
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full rounded-sm">
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {mode === "signin" ? "Se connecter" : "Créer le compte"}
        </Button>
        <button
          type="button"
          className="w-full text-xs text-muted-foreground underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin"
            ? "Première utilisation ? Créer le compte administrateur"
            : "J'ai déjà un compte"}
        </button>
      </form>
    </div>
  );
}


function AdminPage() {
  useForceFrench();
  const { session, isAdmin, loading } = useAdminAuth();
  const { tab } = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery(publicSettingsQuery());

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) return <LoginCard />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-2xl">Accès refusé</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ce compte n'a pas le rôle administrateur. Si vous êtes le propriétaire et
          qu'aucun administrateur n'existe encore, activez-le ci-dessous.
        </p>
        <Button
          className="rounded-sm"
          onClick={async () => {
            const { data, error } = await supabase.rpc("claim_first_admin" as never);
            if (error) {
              toast.error(error.message);
              return;
            }
            if (data) {
              toast.success("Rôle administrateur activé");
              window.location.reload();
            } else {
              toast.error("Un administrateur existe déjà.");
            }
          }}
        >
          Devenir administrateur
        </Button>

        <Button
          variant="outline"
          className="rounded-sm"
          onClick={() => supabase.auth.signOut()}
        >
          Se déconnecter
        </Button>
      </div>
    );
  }

  const page = PAGE_COPY[tab];
  const content: Record<AdminTab, ReactNode> = {
    orders: <OrdersTab />,
    products: <ProductsTab />,
    categories: <CategoriesTab />,
    settings: <SettingsTab />,
  };

  async function logout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full bg-muted/30" dir="ltr">
        <AdminSidebar
          activeTab={tab}
          logoUrl={settings?.logo_url}
          storeName={settings?.site_name}
          onLogout={() => void logout()}
        />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
            <SidebarTrigger className="size-9" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl leading-tight">{page.title}</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{page.subtitle}</p>
            </div>
            <p className="ml-auto hidden max-w-56 truncate text-xs text-muted-foreground lg:block">
              {session.user.email}
            </p>
          </header>
          <main className="w-full min-w-0 px-4 py-6 md:px-6 lg:px-8">
            <div className="mb-6 sm:hidden">
              <p className="text-sm text-muted-foreground">{page.subtitle}</p>
            </div>
            {content[tab]}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
