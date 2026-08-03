import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CategoriesTab } from "@/components/admin/CategoriesTab";
import { OrdersTab } from "@/components/admin/OrdersTab";
import { ProductsTab } from "@/components/admin/ProductsTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  ssr: false,
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
  const [busy, setBusy] = useState(false);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={signIn}
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
            className="rounded-sm"
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full rounded-sm">
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Se connecter
        </Button>
      </form>
    </div>
  );
}

function AdminPage() {
  const { session, isAdmin, loading } = useAdminAuth();

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
        <p className="text-sm text-muted-foreground">
          Ce compte n'a pas le rôle administrateur.
        </p>
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <div>
            <h1 className="font-display text-2xl">Glamour Touch — Admin</h1>
            <p className="text-xs text-muted-foreground">{session.user.email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-sm"
            onClick={() => supabase.auth.signOut()}
          >
            Déconnexion
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Tabs defaultValue="orders">
          <TabsList className="rounded-sm">
            <TabsTrigger value="orders">Commandes</TabsTrigger>
            <TabsTrigger value="products">Produits</TabsTrigger>
            <TabsTrigger value="categories">Catégories</TabsTrigger>
            <TabsTrigger value="settings">Paramètres</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="mt-6">
            <OrdersTab />
          </TabsContent>
          <TabsContent value="products" className="mt-6">
            <ProductsTab />
          </TabsContent>
          <TabsContent value="categories" className="mt-6">
            <CategoriesTab />
          </TabsContent>
          <TabsContent value="settings" className="mt-6">
            <SettingsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
