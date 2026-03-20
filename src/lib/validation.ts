export function validatePasswordStrong(password: string): { valid: boolean; message?: string } {
  if (password.length < 6) {
    return { valid: false, message: "A senha deve ter pelo menos 6 caracteres" };
  }
  if (password.length > 128) {
    return { valid: false, message: "A senha é muito longa" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos uma letra maiúscula" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos uma letra minúscula" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos um número" };
  }
  return { valid: true };
}

export const PASSWORD_HINT =
  "Mínimo 6 caracteres, com pelo menos uma letra maiúscula, uma minúscula e um número";
