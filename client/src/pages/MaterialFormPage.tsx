import { useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { Layout } from "@/components/Layout";
import { MaterialDialog } from "@/components/materials/MaterialDialog";
import { useMaterials } from "@/hooks/use-erp";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthz } from "@/hooks/use-authz";

export default function MaterialFormPage() {
  const [isEditMatch, editParams] = useRoute("/materials/:id/edit");
  const materialId = isEditMatch ? Number((editParams as { id: string }).id) : null;
  const isEditing = materialId !== null;

  const { data: materials, isLoading, error, refetch } = useMaterials();
  const [, navigate] = useLocation();
  const { canWrite } = useAuthz();

  const editMaterial = useMemo(() => {
    if (!isEditing || !materials) return null;
    return materials.find((item) => item.id === materialId) ?? null;
  }, [isEditing, materialId, materials]);

  const goBack = () => navigate("/materials");

  return (
    <Layout hideMobileMenu fullBleed innerClassName="flex h-full w-full">
      {!canWrite ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Sem permissão</AlertTitle>
          <AlertDescription>
            Seu usuário não tem permissão para criar/editar materiais.
            <div className="mt-3">
              <Button variant="outline" onClick={goBack}>
                Voltar para materiais
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {!canWrite ? null : (
        <>
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Não foi possível carregar os materiais</AlertTitle>
          <AlertDescription>
            Verifique se o servidor e o banco estão rodando e tente novamente.
            <div className="mt-3">
              <Button variant="outline" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : isEditing && !editMaterial ? (
        <Alert variant="destructive">
          <AlertTitle>Material não encontrado</AlertTitle>
          <AlertDescription>
            O material informado não existe ou foi removido.
            <div className="mt-3">
              <Button variant="outline" onClick={goBack}>
                Voltar para materiais
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex h-full w-full" style={{ minHeight: "calc(100vh - 0px)" }}>
          <MaterialDialog
            open
            onOpenChange={() => undefined}
            asPage
            onBack={goBack}
            editMaterial={editMaterial}
            allowMultiple={!isEditing}
            title={isEditing ? "Editar material" : "Novo material"}
            description={isEditing ? "Atualize os dados do material selecionado." : "Cadastre um novo material."}
          />
        </div>
      )}
        </>
      )}
    </Layout>
  );
}
