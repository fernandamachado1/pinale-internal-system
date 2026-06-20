import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGate } from "@/components/AuthGate";
import { ThemeProvider } from "@/components/theme-provider";

const NotFound = lazy(() => import("@/pages/not-found"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Materials = lazy(() => import("@/pages/Materials"));
const MaterialFormPage = lazy(() => import("@/pages/MaterialFormPage"));
const Products = lazy(() => import("@/pages/Products"));
const ProducedStock = lazy(() => import("@/pages/ProducedStock"));
const Production = lazy(() => import("@/pages/Production"));
const Sales = lazy(() => import("@/pages/Sales"));
const Movements = lazy(() => import("@/pages/Movements"));
const PurchaseOrders = lazy(() => import("@/pages/PurchaseOrders"));
const Login = lazy(() => import("@/pages/Login"));
const Profile = lazy(() => import("@/pages/Profile"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-border border-t-foreground" />
        <p className="text-sm text-muted-foreground">Carregando tela...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/profile" component={Profile} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/" component={Dashboard} />
      <Route path="/materials/new" component={MaterialFormPage} />
      <Route path="/materials/:id/edit" component={MaterialFormPage} />
      <Route path="/materials" component={Materials} />
      <Route path="/products" component={Products} />
      <Route path="/produced-stock" component={ProducedStock} />
      <Route path="/production" component={Production} />
      <Route path="/purchase-orders" component={PurchaseOrders} />
      <Route path="/sales" component={Sales} />
      <Route path="/movements" component={Movements} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <AuthGate>
            <Suspense fallback={<RouteFallback />}>
              <Router />
            </Suspense>
          </AuthGate>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
