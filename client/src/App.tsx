import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/Dashboard";
import Materials from "@/pages/Materials";
import Products from "@/pages/Products";
import ProducedStock from "@/pages/ProducedStock";
import Production from "@/pages/Production";
import Sales from "@/pages/Sales";
import Movements from "@/pages/Movements";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/materials" component={Materials} />
      <Route path="/products" component={Products} />
      <Route path="/produced-stock" component={ProducedStock} />
      <Route path="/production" component={Production} />
      <Route path="/sales" component={Sales} />
      <Route path="/movements" component={Movements} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
