import { PerfilUsuario } from '@prisma/client';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: PerfilUsuario;
  perfil?: PerfilUsuario;
};
