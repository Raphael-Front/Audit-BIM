import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { compareSync, hashSync } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './types';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    // Inicializar Supabase se as variáveis estiverem configuradas
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && supabaseServiceKey) {
      this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    }
  }

  async login(email: string, password: string) {
    const emailNorm = email.trim().toLowerCase();
    const user = await this.prisma.dimUsuario.findUnique({
      where: { email: emailNorm },
    });
    if (!user || !user.ativo)
      throw new UnauthorizedException('Invalid credentials');
    if (!user.senhaHash || !compareSync(password, user.senhaHash))
      throw new UnauthorizedException('Invalid credentials');

    const payload: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.nomeCompleto,
      role: user.perfil,
      perfil: user.perfil,
    };

    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      user: payload,
    };
  }

  async register(email: string, nomeCompleto: string, password: string) {
    const emailNorm = email.trim().toLowerCase();
    
    // Verificar se o usuário já existe
    const existingUser = await this.prisma.dimUsuario.findUnique({
      where: { email: emailNorm },
    });

    if (existingUser) {
      throw new BadRequestException('Email já cadastrado');
    }

    // Se Supabase estiver configurado, criar usuário no Supabase Auth primeiro
    if (this.supabase) {
      const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
        email: emailNorm,
        password,
        email_confirm: true, // Auto-confirmar email (em produção, você pode querer enviar email de confirmação)
        user_metadata: {
          nome: nomeCompleto,
          name: nomeCompleto,
        },
      });

      if (authError) {
        throw new BadRequestException(`Erro ao criar usuário: ${authError.message}`);
      }

      // Criar usuário no banco local vinculado ao Supabase Auth
      const user = await this.prisma.dimUsuario.create({
        data: {
          email: emailNorm,
          nomeCompleto: nomeCompleto.trim(),
          authUserId: authData.user.id,
          perfil: 'auditor_bim', // Perfil padrão
          ativo: true,
        },
      });

      const payload: AuthUser = {
        id: user.id,
        email: user.email,
        name: user.nomeCompleto,
        role: user.perfil,
        perfil: user.perfil,
      };

      const accessToken = await this.jwt.signAsync(payload);

      return {
        accessToken,
        user: payload,
      };
    }

    // Caso contrário, criar usuário apenas no banco local
    const senhaHash = hashSync(password, 10);
    const user = await this.prisma.dimUsuario.create({
      data: {
        email: emailNorm,
        nomeCompleto: nomeCompleto.trim(),
        senhaHash,
        perfil: 'auditor_bim', // Perfil padrão
        ativo: true,
      },
    });

    const payload: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.nomeCompleto,
      role: user.perfil,
      perfil: user.perfil,
    };

    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      user: payload,
    };
  }

  async logout() {
    // Logout é principalmente gerenciado no frontend
    // Aqui podemos adicionar lógica de blacklist de tokens se necessário
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string) {
    const emailNorm = email.trim().toLowerCase();
    const user = await this.prisma.dimUsuario.findUnique({
      where: { email: emailNorm },
    });

    // Por segurança, não revelamos se o email existe ou não
    if (!user || !user.ativo) {
      // Retornar sucesso mesmo se o usuário não existir (por segurança)
      return { message: 'Se o email existir, você receberá instruções para redefinir sua senha.' };
    }

    // Se o usuário tem auth_user_id, usar Supabase Auth
    if (user.authUserId && this.supabase) {
      const { error } = await this.supabase.auth.resetPasswordForEmail(emailNorm, {
        redirectTo: `${this.config.get<string>('FRONTEND_URL', 'http://localhost:3000')}/reset-password`,
      });

      if (error) {
        throw new BadRequestException('Erro ao enviar email de recuperação. Tente novamente.');
      }

      return { message: 'Se o email existir, você receberá instruções para redefinir sua senha.' };
    }

    // Caso contrário, gerar token próprio e enviar email (implementação básica)
    // Em produção, você deve usar um serviço de email como SendGrid, AWS SES, etc.
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // Token válido por 1 hora

    // Salvar token no banco (você pode criar uma tabela para isso ou usar um campo no usuário)
    // Por enquanto, vamos usar JWT para o token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      type: 'password-reset',
    };
    const token = await this.jwt.signAsync(tokenPayload, { expiresIn: '1h' });

    // TODO: Enviar email com o token
    // Exemplo: await this.emailService.sendPasswordResetEmail(user.email, token);

    // Por enquanto, apenas retornamos sucesso
    // Em produção, você deve implementar o envio de email
    console.log(`Password reset token for ${emailNorm}: ${token}`);

    return { message: 'Se o email existir, você receberá instruções para redefinir sua senha.' };
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      // Tentar verificar o token JWT
      const payload = await this.jwt.verifyAsync(token);
      
      if (payload.type !== 'password-reset') {
        throw new BadRequestException('Token inválido');
      }

      const user = await this.prisma.dimUsuario.findUnique({
        where: { id: payload.userId },
      });

      if (!user || !user.ativo) {
        throw new NotFoundException('Usuário não encontrado');
      }

      // Se o usuário tem auth_user_id, usar Supabase Auth
      if (user.authUserId && this.supabase) {
        // Com Supabase, o reset é feito via link mágico no frontend
        // Este endpoint pode ser usado para validar o token
        const { data, error } = await this.supabase.auth.verifyOtp({
          token_hash: token,
          type: 'recovery',
        });

        if (error) {
          throw new BadRequestException('Token inválido ou expirado');
        }

        // Atualizar senha no Supabase
        const { error: updateError } = await this.supabase.auth.updateUser({
          password: newPassword,
        });

        if (updateError) {
          throw new BadRequestException('Erro ao atualizar senha');
        }

        return { message: 'Senha redefinida com sucesso' };
      }

      // Atualizar senha no banco local
      const senhaHash = hashSync(newPassword, 10);
      await this.prisma.dimUsuario.update({
        where: { id: user.id },
        data: { senhaHash },
      });

      return { message: 'Senha redefinida com sucesso' };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Token inválido ou expirado');
    }
  }
}
