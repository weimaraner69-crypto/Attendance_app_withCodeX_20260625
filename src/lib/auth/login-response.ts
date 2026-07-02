import { getRoleHomePath, type CurrentAuthContext } from '@/lib/auth/session';

export function createLoginResponse(context: CurrentAuthContext) {
  return {
    authenticated: true as const,
    profile: {
      role: context.profile.role,
      display_name: context.profile.display_name,
    },
    redirect_path: getRoleHomePath(context.profile.role, context.managerStore?.id),
  };
}
