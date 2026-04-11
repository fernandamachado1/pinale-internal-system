import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMeProfile, useUpdateMyProfile } from "@/hooks/use-authz";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AtSign, Camera, Link2, Save, UploadCloud, User, UserRound, X } from "lucide-react";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";

export default function Profile() {
  const { toast } = useToast();
  const { data: profile, isLoading, error, refetch } = useMeProfile();
  const updateMutation = useUpdateMyProfile();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const initial = useMemo(
    () => ({
      displayName: profile?.displayName ?? "",
      username: profile?.username ?? "",
      avatarUrl: profile?.avatarUrl ?? "",
    }),
    [profile?.avatarUrl, profile?.displayName, profile?.username],
  );

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);

  const initials = useMemo(() => {
    const value = (profile?.displayName ?? profile?.email ?? "").trim();
    if (!value) return "U";
    const parts = value.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? value[0] ?? "U";
    const second = parts.length > 1 ? parts[1]?.[0] : value[1];
    return (first + (second ?? "")).toUpperCase();
  }, [profile?.displayName, profile?.email]);

  useEffect(() => {
    setDisplayName(initial.displayName);
    setUsername(initial.username);
    setAvatarUrl(initial.avatarUrl);
  }, [initial.avatarUrl, initial.displayName, initial.username]);

  const onCancel = () => {
    setDisplayName(initial.displayName);
    setUsername(initial.username);
    setAvatarUrl(initial.avatarUrl);
  };

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await updateMutation.mutateAsync({
        displayName: displayName.trim() || undefined,
        username: username.trim() || undefined,
        avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
      });
      toast({ title: "Sucesso", description: "Perfil atualizado." });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Não foi possível salvar.", variant: "destructive" });
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!hasSupabaseEnv) {
      toast({ title: "Supabase não configurado", description: "Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.", variant: "destructive" });
      return;
    }
    if (!profile?.id) {
      toast({ title: "Erro", description: "Perfil não carregado.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem.", variant: "destructive" });
      return;
    }
    const maxBytes = 3 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast({ title: "Arquivo muito grande", description: "Máximo: 3MB.", variant: "destructive" });
      return;
    }

    const extFromName = file.name.split(".").pop()?.toLowerCase();
    const extFromType = file.type.split("/").pop()?.toLowerCase();
    const ext = (extFromName || extFromType || "png").replace(/[^a-z0-9]/g, "") || "png";
    const objectPath = `${profile.id}/avatar.${ext}`;

    setIsUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(objectPath, file, {
          upsert: true,
          cacheControl: "3600",
          contentType: file.type,
        });

      if (uploadError) {
        toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(objectPath);
      const publicUrl = data.publicUrl ? `${data.publicUrl}?v=${Date.now()}` : null;
      if (!publicUrl) {
        toast({ title: "Erro", description: "Não foi possível gerar URL pública.", variant: "destructive" });
        return;
      }

      await updateMutation.mutateAsync({ avatarUrl: publicUrl });
      setAvatarUrl(publicUrl);
      toast({ title: "Sucesso", description: "Avatar atualizado." });
    } finally {
      setIsUploading(false);
    }
  };

  const IconInput = ({
    icon: Icon,
    inputClassName,
    ...props
  }: React.ComponentProps<typeof Input> & {
    icon: typeof User;
    inputClassName?: string;
  }) => (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        {...props}
        className={[
          "h-10 rounded-xl bg-muted/30 pl-10",
          inputClassName,
          props.className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
    </div>
  );

  return (
    <Layout>
      <section className="rounded-2xl border bg-card px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <div className="text-lg font-bold tracking-tight text-foreground">Meu perfil</div>
              <div className="text-xs text-muted-foreground">
                Atualize seus dados pessoais e gerencie sua identidade visual no sistema.
              </div>
            </div>
          </div>

          {profile ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={profile.isActive ? "success" : "destructive"}>
                {profile.isActive ? "Ativo" : "Inativo"}
              </Badge>
              <Badge variant="outline" className="uppercase tracking-wider">
                {String(profile.role)}
              </Badge>
            </div>
          ) : null}
        </div>
      </section>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações de Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Atualize seus dados pessoais e gerencie sua identidade visual no sistema.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar seu perfil</AlertTitle>
          <AlertDescription>
            Tente novamente. Se o problema persistir, verifique a API e as variáveis do Supabase.
            <div className="mt-3">
              <Button variant="outline" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <aside className="space-y-6 lg:col-span-4">
          <Card className="overflow-hidden rounded-2xl">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <Avatar className="h-24 w-24 border-4 border-background bg-muted shadow-sm">
                    <AvatarImage src={profile?.avatarUrl ?? undefined} alt={profile?.displayName ?? profile?.email ?? "Usuário"} />
                    <AvatarFallback className="text-xl font-bold">{initials}</AvatarFallback>
                  </Avatar>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-background shadow-sm"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploading || isLoading || !hasSupabaseEnv}
                    aria-label="Alterar foto"
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>

                <h3 className="mt-4 text-lg font-bold text-foreground">Identidade</h3>
                <p className="text-sm text-muted-foreground">{profile?.email ?? "—"}</p>
                <Badge variant="outline" className="mt-2 rounded-lg px-3 py-1 text-[10px] font-semibold uppercase tracking-widest">
                  Permissão: {profile ? String(profile.role) : "—"}
                </Badge>
              </div>

              <div className="mt-8 border-t border-muted pt-6">
                <h4 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Foto do Perfil
                </h4>

                <div className="space-y-3">
                  <label
                    className={[
                      "flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/30 px-4 transition-colors",
                      isDraggingAvatar ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50",
                      (isUploading || isLoading || !hasSupabaseEnv) ? "cursor-not-allowed opacity-70" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onDragOver={(e) => {
                      if (isUploading || isLoading || !hasSupabaseEnv) return;
                      e.preventDefault();
                      setIsDraggingAvatar(true);
                    }}
                    onDragLeave={() => setIsDraggingAvatar(false)}
                    onDrop={(e) => {
                      if (isUploading || isLoading || !hasSupabaseEnv) return;
                      e.preventDefault();
                      setIsDraggingAvatar(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) uploadAvatar(file);
                    }}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <UploadCloud className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
                      <p className="text-center text-xs text-muted-foreground">
                        <span className="font-semibold text-primary">Clique para enviar</span> ou arraste uma foto
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">PNG/JPG até 3MB</p>
                    </div>

                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading || isLoading || !hasSupabaseEnv}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadAvatar(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>

                  {!hasSupabaseEnv ? (
                    <p className="text-[10px] leading-relaxed text-destructive">
                      Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> para habilitar upload.
                    </p>
                  ) : (
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      As imagens ficam no Supabase Storage (bucket <code>avatars</code>) com URL pública.
                    </p>
                  )}
                </div>
              </div>

              {isUploading ? (
                <p className="mt-4 text-xs font-medium text-muted-foreground">Enviando foto…</p>
              ) : null}
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-8">
          <Card className="rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle>Editar perfil</CardTitle>
              <CardDescription>Campos editáveis pelo usuário.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : (
                <form onSubmit={onSave} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="displayName" className="font-semibold">
                        Nome
                      </Label>
                      <IconInput
                        icon={User}
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Ex: Fernanda Souza"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="username" className="flex items-center gap-2 font-semibold">
                        Usuário
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                          Opcional
                        </span>
                      </Label>
                      <div className="relative">
                        <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                          id="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="fernanda_m"
                          className="h-10 rounded-xl bg-muted/30 pl-10"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">Aceita apenas letras minúsculas, números e _</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="avatarUrl" className="flex items-center gap-2 font-semibold">
                      Avatar URL
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                        Opcional
                      </span>
                    </Label>
                    <IconInput
                      icon={Link2}
                      id="avatarUrl"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://exemplo.com/sua-foto.jpg"
                      inputClassName="bg-muted/30"
                      type="url"
                    />
                    <p className="text-[10px] text-muted-foreground">Insira um link direto para uma imagem externa se preferir não fazer upload.</p>
                  </div>

                  <Separator className="my-2" />

                  <div className="flex flex-col-reverse items-center justify-end gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-xl sm:w-auto"
                      onClick={onCancel}
                      disabled={updateMutation.isPending || isUploading}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="w-full rounded-xl sm:w-auto"
                      disabled={updateMutation.isPending || isUploading}
                    >
                      <Save className="h-4 w-4" aria-hidden="true" />
                      {updateMutation.isPending ? "Salvando…" : "Salvar alterações"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-destructive/15 bg-destructive/5 p-6 sm:flex-row sm:items-center">
            <div>
              <h4 className="text-sm font-bold text-foreground">Zona de Perigo</h4>
              <p className="text-xs text-muted-foreground">Remover permanentemente sua conta e todos os dados associados.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={() =>
                toast({
                  title: "Ainda não disponível",
                  description: "A exclusão de conta depende de uma decisão/endpoint no backend.",
                })
              }
            >
              Excluir conta
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
