import { Link } from "@tanstack/react-router";
import { Boxes, LogOut, Package, Settings, ShoppingBag, Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

export type AdminTab = "orders" | "products" | "categories" | "settings";

const items = [
  { tab: "orders" as const, label: "Commandes", icon: ShoppingBag },
  { tab: "products" as const, label: "Produits", icon: Package },
  { tab: "categories" as const, label: "Catégories", icon: Tags },
  { tab: "settings" as const, label: "Paramètres", icon: Settings },
];

type AdminSidebarProps = {
  activeTab: AdminTab;
  logoUrl?: string | null | undefined;
  storeName?: string | null | undefined;
  onLogout: () => void;
};

export function AdminSidebar({ activeTab, logoUrl, storeName, onLogout }: AdminSidebarProps) {
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <Link
          to="/"
          className="flex h-11 min-w-0 items-center gap-3 overflow-hidden rounded-md px-1"
          onClick={() => setOpenMobile(false)}
        >
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-sidebar-border bg-background">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="size-full object-contain p-1" />
            ) : (
              <Boxes className="size-4 text-primary" />
            )}
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate font-display text-base font-medium">{storeName || "Glamour Touch"}</p>
            <p className="truncate text-xs text-muted-foreground">Administration</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestion</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.tab}>
                  <SidebarMenuButton
                    asChild
                    isActive={activeTab === item.tab}
                    tooltip={item.label}
                    className="h-10"
                  >
                    <Link
                      to="/admin"
                      search={{ tab: item.tab }}
                      onClick={() => setOpenMobile(false)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full justify-start gap-2 px-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:px-2"
          onClick={onLogout}
          title="Déconnexion"
        >
          <LogOut className="size-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">Déconnexion</span>
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}