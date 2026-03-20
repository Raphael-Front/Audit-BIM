-- Permite que o usuário atualize seu próprio perfil (avatar_url, nomeCompleto) em dim_usuarios
CREATE POLICY "dim_usuarios_self_update" ON public.dim_usuarios
FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());
