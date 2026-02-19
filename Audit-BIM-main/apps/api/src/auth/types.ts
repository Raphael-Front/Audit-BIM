import { PerfilUsuario } from '@bim-audit/db';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: PerfilUsuario;
  perfil?: PerfilUsuario;
};
