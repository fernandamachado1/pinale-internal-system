# Layout Components

## Layout (`client/src/components/Layout.tsx`)
- Description: Primary app shell with sidebar navigation, mobile sheet + breadcrumb area, and page container that applies padding and animation hooks.
- Key props: `children`, `hideMobileMenu`, `fullBleed`, `innerClassName`.

```tsx
import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Layers,
  Factory,
  ShoppingCart,
  ArrowLeftRight,
  ClipboardList,
  Menu,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";

interface LayoutProps {
  children: ReactNode;
  hideMobileMenu?: boolean;
  fullBleed?: boolean;
  innerClassName?: string;
}

export function Layout({ children, hideMobileMenu = false, fullBleed = false, innerClassName }: LayoutProps) {
  const [location, navigate] = useLocation();

  const logout = async () => {
    await supabase.auth.signOut().catch(() => undefined);
    navigate("/login");
  };

  const dashboardItem = {
    icon: LayoutDashboard,
    label: "Painel Geral",
    href: "/",
  };

  const menuGroups = [
    {
      label: "Cadastros",
      items: [
        { icon: Layers, label: "Materiais", href: "/materials" },
        { icon: Package, label: "Produtos", href: "/products" },
      ],
    },
    {
      label: "Operação",
      items: [
        { icon: Factory, label: "Ordens de Produção", href: "/production" },
        { icon: Boxes, label: "Estoque Pronto", href: "/produced-stock" },
        { icon: ClipboardList, label: "Ordens de Compra", href: "/purchase-orders" },
        { icon: ShoppingCart, label: "Vendas", href: "/sales" },
      ],
    },
    {
      label: "Controle",
      items: [
        { icon: ArrowLeftRight, label: "Histórico de Estoque", href: "/movements" },
      ],
    },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3 border-b border-sidebar-border">
        <div
          role="img"
          aria-label="Pinale ERP"
          className="w-10 h-10 bg-primary shrink-0"
          style={{
            WebkitMaskImage: "url(/logo.png)",
            maskImage: "url(/logo.png)",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
        <div>
          <span className="font-bold text-lg tracking-tight text-sidebar-foreground leading-none block">
            Pinale 
          </span>
          <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-semibold">
            ERP
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-5 space-y-6 overflow-y-auto">
        {/* Dashboard */}
        <div>
          <Link
            href={dashboardItem.href}
            aria-current={location === dashboardItem.href ? "page" : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
              location === dashboardItem.href
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            }`}
          >
            <dashboardItem.icon className="w-[18px] h-[18px] shrink-0" />
            <span className="text-sm font-medium">{dashboardItem.label}</span>
          </Link>
        </div>

        {/* Groups */}
        {menuGroups.map((group) => (
          <div key={group.label}>
            <h3 className="px-3 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/50 mb-2">
              {group.label}
            </h3>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`}
                  >
                    <item.icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button variant="ghost" className="w-full justify-start gap-2" onClick={logout}>
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 h-screen sticky top-0 z-30 shrink-0">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        {!hideMobileMenu ? (
          <div className="flex h-16 items-center px-6 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 border-r-0">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          </div>
        ) : null}

        {/* Page Content */}
        <div className={`${fullBleed ? "p-0" : "px-4 py-6 sm:px-5 md:px-6 lg:px-8"} overflow-x-hidden`}>
          <div
            className={innerClassName ?? "flex h-full w-full flex-col gap-6 max-w-7xl mx-auto animate-in fade-in duration-500 slide-in-from-bottom-2"}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
```

## AuthGate (`client/src/components/AuthGate.tsx`)
- Description: Wrapper that waits for Supabase session, shows login redirect, and renders a placeholder when Supabase env vars are missing.
- Key props: `children` (React node)

```tsx
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    let didInit = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      if (!isMounted) return;
      setSession(nextSession);
      if (!didInit) {
        didInit = true;
        setIsLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!isMounted) return;
      setSession(data.session);
      if (!didInit) {
        didInit = true;
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (location === "/login" && session) {
      navigate("/");
      return;
    }
    if (location === "/login") return;
    if (!session) navigate("/login");
  }, [isLoading, location, navigate, session]);

  if (isLoading) return null;
  if (!hasSupabaseEnv) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg text-sm text-muted-foreground">
          <p className="font-semibold text-foreground mb-2">Configuração pendente</p>
          <p>
            Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no seu <code>.env</code> (na raiz do projeto)
            e reinicie <code>yarn dev</code>.
          </p>
        </div>
      </div>
    );
  }
  if (!session && location !== "/login") return null;
  return <>{children}</>;
}
```
