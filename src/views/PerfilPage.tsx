import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { updateUserName, updateUserEmail, updateUserPassword, updateUserAvatar, uploadAvatarToStorage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";
import { validatePasswordStrong, PASSWORD_HINT } from "@/lib/validation";

/** Tamanho máximo da foto de perfil em bytes (2MB) */
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

export function PerfilPage() {
  const { me, reloadMe } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Sincronizar dados do usuário quando me carregar/atualizar
  useEffect(() => {
    if (me) {
      setName(me.name);
      setEmail(me.email);
      if (me.avatarUrl && !selectedFile) {
        setAvatarUrl(me.avatarUrl);
      }
    }
  }, [me?.id, me?.name, me?.email, me?.avatarUrl]);

  const updateNameMutation = useMutation({
    mutationFn: () => updateUserName(me!.id, name),
    onSuccess: () => {
      reloadMe();
      toast.success("Nome atualizado com sucesso!");
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: () => updateUserEmail(email),
    onSuccess: () => {
      reloadMe();
      toast.success("Email atualizado com sucesso! Verifique seu email para confirmar a alteração.");
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: () => {
      if (newPassword !== confirmPassword) {
        throw new Error("As senhas não coincidem.");
      }
      const pwdValidation = validatePasswordStrong(newPassword);
      if (!pwdValidation.valid) {
        throw new Error(pwdValidation.message ?? "Senha inválida");
      }
      return updateUserPassword(newPassword);
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha atualizada com sucesso!");
    },
  });

  const updateAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("Nenhum arquivo selecionado");
      const publicUrl = await uploadAvatarToStorage(selectedFile);
      await updateUserAvatar(me!.id, publicUrl);
      return publicUrl;
    },
    onSuccess: (url) => {
      setAvatarUrl(url);
      setPreviewAvatar(null);
      setSelectedFile(null);
      reloadMe();
      toast.success("Foto de perfil atualizada com sucesso!");
    },
  });

  const handleFileSelect = (file: File | null) => {
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!me) {
    return (
      <Container>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Carregando...</p>
      </Container>
    );
  }

  return (
    <Container>
      <PageHeader
        title="Perfil"
        subtitle="Gerencie suas informações pessoais"
      />

      {/* Card único com todas as informações do perfil */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)] space-y-8">
        {/* Foto de perfil */}
        <section className="pb-8 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]" style={{ fontFamily: "var(--font-display)" }}>Foto de perfil</h2>
        <div className="mt-4 flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-[var(--color-bg)] flex items-center justify-center overflow-hidden group relative cursor-pointer">
            {previewAvatar ? (
              <img src={previewAvatar} alt="Preview" className="h-full w-full object-cover" />
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-semibold text-[var(--color-text-muted)]">
                {me.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2" /></svg>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex gap-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > MAX_AVATAR_SIZE) {
                        toast.error(`O arquivo deve ter no máximo ${MAX_AVATAR_SIZE / 1024 / 1024}MB`);
                        return;
                      }
                      handleFileSelect(file);
                    }
                  }}
                />
                <span className="inline-block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg)] transition-all duration-150 focus-within:ring-[3px] focus-within:ring-[var(--color-accent-soft)]">
                  Selecionar foto
                </span>
              </label>
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => updateAvatarMutation.mutate()}
                  disabled={updateAvatarMutation.isPending}
                  className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all duration-150"
                >
                  {updateAvatarMutation.isPending ? "Salvando..." : "Salvar foto"}
                </button>
              )}
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewAvatar(null);
                  }}
                  className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">JPG, PNG, GIF ou WebP. Máx. 2MB</p>
            {updateAvatarMutation.isError && (
              <p className="mt-2 text-sm text-red-600">{String(updateAvatarMutation.error?.message)}</p>
            )}
          </div>
        </div>
        </section>

        {/* Nome */}
        <section className="pb-8 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]" style={{ fontFamily: "var(--font-display)" }}>Nome completo</h2>
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:ring-[3px] focus:ring-[var(--color-accent-soft)] focus:outline-none"
            placeholder="Seu nome completo"
          />
          <button
            type="button"
            onClick={() => updateNameMutation.mutate()}
            disabled={updateNameMutation.isPending || name === me.name}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all duration-150"
          >
            {updateNameMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
        {updateNameMutation.isError && (
          <p className="mt-2 text-sm text-red-600">{String(updateNameMutation.error?.message)}</p>
        )}
        </section>

        {/* Email */}
        <section className="pb-8 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]" style={{ fontFamily: "var(--font-display)" }}>Email</h2>
        <div className="mt-4 flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:ring-[3px] focus:ring-[var(--color-accent-soft)] focus:outline-none"
            placeholder="seu@email.com"
          />
          <button
            type="button"
            onClick={() => updateEmailMutation.mutate()}
            disabled={updateEmailMutation.isPending || email === me.email}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all duration-150"
          >
            {updateEmailMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
        {updateEmailMutation.isError && (
          <p className="mt-2 text-sm text-red-600">{String(updateEmailMutation.error?.message)}</p>
        )}
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
          Você receberá um email de confirmação ao alterar o email.
        </p>
        </section>

        {/* Senha */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]" style={{ fontFamily: "var(--font-display)" }}>Alterar senha</h2>
        <div className="mt-4 space-y-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:ring-[3px] focus:ring-[var(--color-accent-soft)] focus:outline-none"
            placeholder="Nova senha"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:ring-[3px] focus:ring-[var(--color-accent-soft)] focus:outline-none"
            placeholder="Confirmar nova senha"
          />
          <button
            type="button"
            onClick={() => updatePasswordMutation.mutate()}
            disabled={updatePasswordMutation.isPending || !newPassword || !confirmPassword}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all duration-150"
          >
            {updatePasswordMutation.isPending ? "Salvando..." : "Alterar senha"}
          </button>
        </div>
        {updatePasswordMutation.isError && (
          <p className="mt-2 text-sm text-red-600">{String(updatePasswordMutation.error?.message)}</p>
        )}
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{PASSWORD_HINT}</p>
        </section>
      </div>
    </Container>
  );
}

