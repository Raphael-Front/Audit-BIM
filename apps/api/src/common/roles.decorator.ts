import { SetMetadata } from '@nestjs/common';
import { PerfilUsuario } from '@bim-audit/db';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: PerfilUsuario[]) =>
  SetMetadata(ROLES_KEY, roles);
