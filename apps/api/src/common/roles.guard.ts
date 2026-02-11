import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PerfilUsuario } from '@bim-audit/db';
import { ROLES_KEY } from './roles.decorator';

/** Mapeia valores legados do token (UserRole) para o novo PerfilUsuario. */
const LEGACY_TO_PERFIL: Record<string, PerfilUsuario> = {
  ADMIN: PerfilUsuario.admin_bim,
  admin_bim: PerfilUsuario.admin_bim,
  AUDITOR: PerfilUsuario.auditor_bim,
  auditor_bim: PerfilUsuario.auditor_bim,
  READER: PerfilUsuario.leitor,
  leitor: PerfilUsuario.leitor,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<PerfilUsuario[]>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as { role?: string; perfil?: PerfilUsuario } | undefined;
    const raw = user?.perfil ?? user?.role;
    if (!raw) return false;
    const perfil = LEGACY_TO_PERFIL[raw] ?? (raw as PerfilUsuario);
    return requiredRoles.includes(perfil);
  }
}
