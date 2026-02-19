import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Package, 
  Layers, 
  Factory, 
  ShoppingCart, 
  ArrowLeftRight,
  Menu,
  Box,
  Search,
  Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Layers, label: "Insumos", href: "/materials" },
    { icon: Package, label: "Produtos", href: "/products" },
    { icon: Factory, label: "Produção", href: "/production" },
    { icon: ShoppingCart, label: "Vendas", href: "/sales" },
    { icon: ArrowLeftRight, label: "Movimentações", href: "/movements" },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card border-r border-border/50">
      <div className="p-6 flex items-center gap-3 border-b border-border/50">
        <div className="bg-primary/10 p-2 rounded-lg text-primary">
          <Box className="w-6 h-6" />
        </div>
        <span className="font-display font-bold text-xl tracking-tight text-foreground">
          Nexus ERP
        </span>
      </div>
      
      <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">
          Menu Principal
        </div>
        {menuItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div 
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200
                  ${isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }
                `}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                {item.label}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">Admin User</span>
            <span className="text-xs text-muted-foreground">admin@nexus.com</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 h-screen sticky top-0 z-30">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-20 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 border-r border-border/50">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            
            <div className="relative hidden sm:block max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar em todo sistema..." 
                className="pl-9 bg-background/50 border-border/50 focus:bg-background transition-all w-[300px]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 md:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-2">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
