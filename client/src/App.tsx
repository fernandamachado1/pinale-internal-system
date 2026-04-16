import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/Dashboard";
import Materials from "@/pages/Materials";
import MaterialFormPage from "@/pages/MaterialFormPage";
import Products from "@/pages/Products";
import ProducedStock from "@/pages/ProducedStock";
import Production from "@/pages/Production";
import Sales from "@/pages/Sales";
import Movements from "@/pages/Movements";
import PurchaseOrders from "@/pages/PurchaseOrders";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";
import AdminUsers from "@/pages/AdminUsers";
import { AuthGate } from "@/components/AuthGate";
import { ThemeProvider } from "@/components/theme-provider";

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
            <Router />
          </AuthGate>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
