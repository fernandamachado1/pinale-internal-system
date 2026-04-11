import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { AdminInviteUserInput, AdminUpdateUserInput, Profile, UpdateMyProfileInput, UserRole } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function useMeProfile() {
  return useQuery<Profile>({
    queryKey: [api.me.profile.get.path],
  });
}

export function useAuthz() {
  const { data: profile, isLoading, isFetching } = useMeProfile();
  const role = (profile?.role as UserRole | undefined) ?? undefined;
  const isAdmin = role === "ADMIN";
  const canWrite = role === "ADMIN" || role === "STAFF";
  const isAuthzLoading = isLoading || isFetching;
  return { role, isAdmin, canWrite, profile, isAuthzLoading };
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateMyProfileInput) => {
      const res = await apiRequest("PATCH", api.me.profile.update.path, input);
      return (await res.json()) as Profile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData([api.me.profile.get.path], profile);
    },
  });
}

export function useAdminUsers() {
  return useQuery<Profile[]>({
    queryKey: [api.admin.users.list.path],
  });
}

export function useAdminInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminInviteUserInput) => {
      const res = await apiRequest("POST", api.admin.users.invite.path, input);
      return (await res.json()) as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.users.list.path] });
    },
  });
}

export function useAdminUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; input: AdminUpdateUserInput }) => {
      const res = await apiRequest("PATCH", buildUrl(api.admin.users.update.path, { id: params.id }), params.input);
      return (await res.json()) as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.users.list.path] });
    },
  });
}
