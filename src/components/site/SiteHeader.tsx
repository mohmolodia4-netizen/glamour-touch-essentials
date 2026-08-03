import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { useState } from "react";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { categoriesQuery, publicSettingsQuery } from "@/lib/store";

const navLinks = [
  { to: "/", label: "Accueil" },
  { to: "/boutique", label: "Boutique" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { data: settings } = useQuery(publicSettingsQuery());
  const { data: categories = [] } = useQuery(categoriesQuery());

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <nav className="mt-10 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="rounded-sm px-3 py-3 text-sm uppercase tracking-[0.18em] text-foreground hover:bg-secondary"
                >
                  {link.label}
                </Link>
              ))}
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to="/boutique"
                  search={{ categorie: category.slug }}
                  onClick={() => setOpen(false)}
                  className="rounded-sm px-3 py-3 text-sm text-muted-foreground hover:bg-secondary"
                >
                  {category.name}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-xs uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link to="/" className="flex flex-col items-center">
          <span className="font-display text-2xl leading-none tracking-[0.24em] text-primary">
            {settings?.site_name ?? "GLAMOUR TOUCH"}
          </span>
          <span className="mt-1 text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
            Bags &amp; Accessories
          </span>
        </Link>

        <div className="hidden w-40 justify-end md:flex">
          {settings?.whatsapp ? (
            <a
              href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-primary"
            >
              Contact
            </a>
          ) : null}
        </div>
        <div className="w-10 md:hidden" />
      </div>
    </header>
  );
}
