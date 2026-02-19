import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { authMe, updateUserName, updateUserEmail, updateUserPassword, updateUserAvatar, type MeResponse } from "@/lib/api";
import { createSupabaseClient } from "@/lib/supabase/client";

const supabase = createSupabaseClient();

/** Tamanho máximo da foto de perfil em bytes (10MB) */
const MAX_AVATAR_SIZE = 10 * 1024 * 1024;

export function PerfilPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery<MeResponse>({ queryKey: ["me"], queryFn: authMe });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Carregar dados do usuário
  useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const user = me;
      if (user) {
        setName(user.name);
        setEmail(user.email);
        if (user.avatarUrl) {
          setAvatarUrl(user.avatarUrl);
          setPreviewAvatar(null);
        }
      }
      return user;
    },
    enabled: !!me,
  });

  const updateNameMutation = useMutation({
    mutationFn: () => updateUserName(me!.id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      alert("Nome atualizado com sucesso!");
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: () => updateUserEmail(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      alert("Email atualizado com sucesso! Verifique seu email para confirmar a alteração.");
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: () => {
      if (newPassword !== confirmPassword) {
        throw new Error("As senhas não coincidem.");
      }
      if (newPassword.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres.");
      }
      return updateUserPassword(newPassword);
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      alert("Senha atualizada com sucesso!");
    },
  });

  const updateAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("Nenhum arquivo selecionado");
      // Upload para Supabase Storage (se configurado) ou usar URL direta
      // Por enquanto, vamos usar uma URL simples ou base64
      const reader = new FileReader();
      return new Promise<string>((resolve, reject) => {
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          // Aqui você pode fazer upload para storage ou salvar base64
          // Por simplicidade, vamos salvar a URL base64
          await updateUserAvatar(me!.id, base64);
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });
    },
    onSuccess: (url) => {
      setAvatarUrl(url);
      setPreviewAvatar(null);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      alert("Foto de perfil atualizada com sucesso!");
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

      {/* Foto de perfil */}
      <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Foto de perfil</h2>
        <div className="mt-4 flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center overflow-hidden">
            {previewAvatar ? (
              <img src={previewAvatar} alt="Preview" className="h-full w-full object-cover" />
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-semibold text-[hsl(var(--muted-foreground))]">
                {me.name.charAt(0).toUpperCase()}
              </span>
            )}
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
                        alert(`O arquivo deve ter no máximo ${MAX_AVATAR_SIZE / 1024 / 1024}MB`);
                        return;
                      }
                      handleFileSelect(file);
                    }
                  }}
                />
                <span className="inline-block rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
                  Selecionar foto
                </span>
              </label>
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => updateAvatarMutation.mutate()}
                  disabled={updateAvatarMutation.isPending}
                  className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
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
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">JPG, PNG ou GIF. Máx. 10MB</p>
            {updateAvatarMutation.isError && (
              <p className="mt-2 text-sm text-red-600">{String(updateAvatarMutation.error?.message)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Nome */}
      <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Nome completo</h2>
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
            placeholder="Seu nome completo"
          />
          <button
            type="button"
            onClick={() => updateNameMutation.mutate()}
            disabled={updateNameMutation.isPending || name === me.name}
            className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
          >
            {updateNameMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
        {updateNameMutation.isError && (
          <p className="mt-2 text-sm text-red-600">{String(updateNameMutation.error?.message)}</p>
        )}
      </div>

      {/* Email */}
      <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Email</h2>
        <div className="mt-4 flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
            placeholder="seu@email.com"
          />
          <button
            type="button"
            onClick={() => updateEmailMutation.mutate()}
            disabled={updateEmailMutation.isPending || email === me.email}
            className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
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
      </div>

      {/* Senha */}
      <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">Alterar senha</h2>
        <div className="mt-4 space-y-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
            placeholder="Nova senha"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
            placeholder="Confirmar nova senha"
          />
          <button
            type="button"
            onClick={() => updatePasswordMutation.mutate()}
            disabled={updatePasswordMutation.isPending || !newPassword || !confirmPassword}
            className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 disabled:opacity-50"
          >
            {updatePasswordMutation.isPending ? "Salvando..." : "Alterar senha"}
          </button>
        </div>
        {updatePasswordMutation.isError && (
          <p className="mt-2 text-sm text-red-600">{String(updatePasswordMutation.error?.message)}</p>
        )}
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">A senha deve ter pelo menos 6 caracteres.</p>
      </div>
    </Container>
  );
}

