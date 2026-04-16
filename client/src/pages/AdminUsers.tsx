import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAdminInviteUser, useAdminUpdateUser, useAdminUsers, useAuthz } from "@/hooks/use-authz";
import type { UserRole } from "@shared/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Mail, Plus, ShieldCheck, Users } from "lucide-react";
import { useLocation } from "wouter";

const roles: UserRole[] = ["ADMIN", "STAFF", "VIEWER"];

const roleLabel: Record<UserRole, string> = {
  ADMIN: "Admin",
  STAFF: "Operação",
  VIEWER: "Leitura",
};

const roleDescription: Record<UserRole, string> = {
  ADMIN: "Gerencia usuários e tem acesso total.",
  STAFF: "Pode criar/editar no ERP.",
  VIEWER: "Acesso somente leitura.",
};

export default function AdminUsers() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const authz = useAuthz();
  const { data: users, isLoading, error, refetch } = useAdminUsers();
  const inviteMutation = useAdminInviteUser();
  const updateMutation = useAdminUpdateUser();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("VIEWER");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");
  const [activeOnly, setActiveOnly] = useState(false);

  const sorted = useMemo(() => {
    const items = users ?? [];
    // Admins first, then active, then email.
    return [...items].sort((a, b) => {
      const roleScore = (r: UserRole) => (r === "ADMIN" ? 0 : r === "STAFF" ? 1 : 2);
      const ar = roleScore(a.role as UserRole);
      const br = roleScore(b.role as UserRole);
      if (ar !== br) return ar - br;
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return String(a.email ?? "").localeCompare(String(b.email ?? ""));
    });
  }, [users]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sorted.filter((u) => {
      if (activeOnly && !u.isActive) return false;
      if (roleFilter !== "ALL" && (u.role as UserRole) !== roleFilter) return false;
      if (!term) return true;
      const hay = `${u.email ?? ""} ${u.displayName ?? ""} ${u.username ?? ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [activeOnly, roleFilter, search, sorted]);

  if (!authz.isAdmin) {
    navigate("/");
    return null;
  }

  const onInvite = async () => {
    try {
      await inviteMutation.mutateAsync({ email: inviteEmail, role: inviteRole });
      toast({ title: "Sucesso", description: "Convite enviado." });
      setInviteEmail("");
      setInviteRole("VIEWER");
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Não foi possível convidar.", variant: "destructive" });
    }
  };

  const onChangeRole = async (id: string, role: UserRole) => {
    try {
      await updateMutation.mutateAsync({ id, input: { role } });
      toast({ title: "Sucesso", description: "Permissão atualizada." });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Não foi possível atualizar.", variant: "destructive" });
    }
  };

  const onToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateMutation.mutateAsync({ id, input: { isActive } });
      toast({ title: "Sucesso", description: isActive ? "Usuário reativado." : "Usuário desativado." });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Não foi possível atualizar.", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <section className="rounded-xl border bg-card/60 px-4 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Users className="h-4 w-4" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Usuários</h2>
            </div>
            <p className="text-sm text-muted-foreground">Convide usuários e gerencie permissões e acesso.</p>
          </div>

          <ResponsiveDialog>
            <ResponsiveDialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Convidar
              </Button>
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent className="max-w-lg">
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">Convidar usuário</ResponsiveDialogTitle>
                <ResponsiveDialogDescription className="text-sm text-foreground/75">O usuário receberá um e-mail para definir a senha.</ResponsiveDialogDescription>
              </ResponsiveDialogHeader>

              <div className="space-y-5 px-4 md:px-0">
                <div className="rounded-lg border bg-card px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Mail className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">Convite por e-mail</div>
                      <div className="text-xs text-muted-foreground">Recomendado para controle interno de acesso.</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inviteEmail">E-mail</Label>
                  <Input
                    id="inviteEmail"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="novo@exemplo.com"
                    className="h-11 rounded-xl border-border bg-card px-4"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Permissão</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                    <SelectTrigger className="h-11 rounded-xl border-border bg-card px-4">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabel[r]} — {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{roleDescription[inviteRole]}</span>
                  </div>
                </div>
              </div>

              <ResponsiveDialogFooter className="justify-end gap-2">
                <Button onClick={onInvite} disabled={inviteMutation.isPending || !inviteEmail.trim()}>
                  {inviteMutation.isPending ? "Enviando…" : "Enviar convite"}
                </Button>
              </ResponsiveDialogFooter>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </div>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar usuários</AlertTitle>
          <AlertDescription>
            Tente novamente. Se o problema persistir, verifique se a API está com acesso ao banco.
            <div className="mt-3">
              <Button variant="outline" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>
            {filtered.length} usuário(s) exibido(s){users ? ` • ${users.length} total` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por e-mail, nome ou usuário"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
                    <SelectTrigger className="w-[170px]">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas</SelectItem>
                      {roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabel[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <Switch checked={activeOnly} onCheckedChange={(v) => setActiveOnly(Boolean(v))} />
                    <span className="text-sm">Só ativos</span>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Users className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="text-sm font-semibold">Nenhum usuário encontrado</div>
                  <div className="text-sm text-muted-foreground">Ajuste os filtros ou convide um novo usuário.</div>
                </div>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Permissão</TableHead>
                        <TableHead className="text-right">Ativo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((u) => {
                        const isSelf = String(u.id) === String(authz.profile?.id ?? "");
                        return (
                          <TableRow key={u.id}>
                            <TableCell>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">{u.displayName ?? "—"}</div>
                                <div className="truncate text-xs text-muted-foreground">{u.email ?? "—"}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Select
                                  value={u.role as UserRole}
                                  onValueChange={(v) => onChangeRole(String(u.id), v as UserRole)}
                                  disabled={isSelf}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {roles.map((r) => (
                                      <SelectItem key={r} value={r}>
                                        {roleLabel[r]} — {r}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Badge variant="secondary">{roleLabel[u.role as UserRole]}</Badge>
                                {isSelf ? <Badge variant="outline">Você</Badge> : null}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {roleDescription[u.role as UserRole]}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                <Switch
                                  checked={Boolean(u.isActive)}
                                  onCheckedChange={(v) => onToggleActive(String(u.id), Boolean(v))}
                                  disabled={isSelf}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
