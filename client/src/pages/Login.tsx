import { useEffect, useState } from "react";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, KeyRound, Lock, Mail } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Login() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    const saved = window.localStorage.getItem("pinale.login.email") ?? "";
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, [hasSupabaseEnv]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasSupabaseEnv) return;
    setIsSubmitting(true);
    try {
      const normalizedEmail = email.trim();
      if (remember) {
        window.localStorage.setItem("pinale.login.email", normalizedEmail);
      } else {
        window.localStorage.removeItem("pinale.login.email");
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      // Full reload ensures AuthGate sees the persisted session immediately.
      window.location.href = "/";
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10 sm:px-6">
      <div className="fixed right-4 top-4 z-20">
        <ThemeToggle className="h-9 rounded-lg px-3" />
      </div>
      <Card className="w-full max-w-[420px] rounded-2xl shadow-sm">
        <CardHeader className="text-center space-y-3 pb-6">
          <div className="mx-auto inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Lock className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</CardTitle>
            <CardDescription className="mt-1">
              Insira suas credenciais para acessar o Pinale ERP.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {!hasSupabaseEnv ? (
            <p className="text-sm text-muted-foreground">
              Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no <code>.env</code> e reinicie o servidor.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 rounded-lg pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password">Senha</Label>
                  <button
                    type="button"
                    className="text-xs font-semibold text-foreground hover:underline"
                    onClick={() =>
                      toast({
                        title: "Esqueceu a senha?",
                        description: "Peça ao administrador para redefinir sua senha.",
                      })
                    }
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 rounded-lg pl-10"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 select-none">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(v) => setRemember(Boolean(v))}
                  aria-label="Lembrar de mim"
                />
                <span className="text-sm text-muted-foreground">Lembrar de mim</span>
              </label>

              <Button
                type="submit"
                className="w-full rounded-lg py-3 gap-2 group"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Entrando..." : "Acessar conta"}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Button>

              <p className="text-center text-sm text-muted-foreground pt-2">
                Não tem acesso? <span className="font-semibold text-foreground">Fale com o administrador.</span>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
