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
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { useAuthz } from "@/hooks/use-authz";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/theme-toggle";

interface LayoutProps {
  children: ReactNode;
  hideMobileMenu?: boolean;
  fullBleed?: boolean;
  innerClassName?: string;
}

export function Layout({ children, hideMobileMenu = false, fullBleed = false, innerClassName }: LayoutProps) {
  const [location, navigate] = useLocation();
  const { isAdmin, canWrite, role, profile, isAuthzLoading } = useAuthz();

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
        { icon: ClipboardList, label: "Compras", href: "/purchase-orders" },
        { icon: Factory, label: "Produção", href: "/production" },
        { icon: Boxes, label: "Estoque", href: "/produced-stock" },
        { icon: ShoppingCart, label: "Vendas", href: "/sales" },
      ],
    },
    {
      label: "Controle",
      items: [
        { icon: ArrowLeftRight, label: "Histórico de Estoque", href: "/movements" },
      ],
    },
    {
      label: "Conta",
      items: [
        { icon: UserRound, label: "Meu Perfil", href: "/profile" },
        ...(isAdmin ? [{ icon: Users, label: "Usuários", href: "/admin/users" }] : []),
      ],
    },
  ];

  const initials = (() => {
    const value = (profile?.displayName ?? profile?.email ?? "").trim();
    if (!value) return "U";
    const parts = value.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? value[0] ?? "U";
    const second = parts.length > 1 ? parts[1]?.[0] : value[1];
    return (first + (second ?? "")).toUpperCase();
  })();

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground md:border-r md:border-sidebar-border md:shadow-[8px_0_32px_rgba(15,23,42,0.04)]">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
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
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {/* Dashboard */}
        <div>
          <Link
            href={dashboardItem.href}
            aria-current={location === dashboardItem.href ? "page" : undefined}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 ${
              location === dashboardItem.href
                ? "bg-sidebar-accent text-sidebar-foreground shadow-sm before:absolute before:left-0 before:top-2 before:h-6 before:w-1 before:rounded-full before:bg-primary"
                : "text-sidebar-foreground/72 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
            }`}
          >
            <dashboardItem.icon className="w-[18px] h-[18px] shrink-0" />
            <span className="text-sm font-medium">{dashboardItem.label}</span>
          </Link>
        </div>

        {/* Groups */}
        {menuGroups.map((group) => (
          <div key={group.label}>
            <h3 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/50">
              {group.label}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-150 ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-foreground shadow-sm before:absolute before:left-0 before:top-2 before:h-6 before:w-1 before:rounded-full before:bg-primary"
                        : "text-sidebar-foreground/72 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
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
        <div className="mb-3">
          <ThemeToggle className="h-10 w-full justify-start gap-2 rounded-xl border border-sidebar-border bg-background/70 px-3 shadow-sm transition-colors hover:bg-background" />
        </div>
        <Link
          href="/profile"
          className="mb-3 flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-sidebar-border hover:bg-sidebar-accent/60"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={profile?.avatarUrl ?? undefined} alt={profile?.displayName ?? profile?.email ?? "Usuário"} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-sidebar-foreground">{profile?.displayName ?? "Meu perfil"}</div>
            <div className="truncate text-xs text-sidebar-foreground/60">{profile?.email ?? "—"}</div>
          </div>
        </Link>
        <Button variant="ghost" className="w-full justify-start gap-2 rounded-xl hover:bg-sidebar-accent/70" onClick={logout}>
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 h-screen sticky top-0 z-30 shrink-0">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        {!hideMobileMenu ? (
          <div className="flex h-16 items-center justify-between px-4 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Abrir menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 border-r-0 bg-sidebar p-0">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <ThemeToggle className="h-9 rounded-lg border border-sidebar-border bg-background/70 px-3 shadow-sm" />
          </div>
        ) : null}

        {/* Page Content */}
        <div className={`${fullBleed ? "p-0" : "px-4 py-6 sm:px-5 md:px-6 lg:px-8"} overflow-x-hidden`}>
          <div
            className={innerClassName ?? "flex h-full w-full flex-col gap-6 max-w-7xl mx-auto animate-in fade-in duration-500 slide-in-from-bottom-2"}
          >
            {!isAuthzLoading && !canWrite ? (
              <Alert>
                <AlertTitle>Modo leitura</AlertTitle>
                <AlertDescription>
                  Seu acesso atual é <span className="font-semibold">{role ?? "—"}</span>. Você pode navegar e consultar dados, mas não pode criar/editar.
                </AlertDescription>
              </Alert>
            ) : null}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
