import { toast as sonnerToast } from "sonner";

export const toast = {
  success: (message: string, options?: { description?: string }) => {
    sonnerToast.success(message, options);
  },
  error: (message: string, options?: { description?: string }) => {
    sonnerToast.error(message, options);
  },
  info: (message: string, options?: { description?: string }) => {
    sonnerToast.info(message, options);
  },
  promise: sonnerToast.promise,
};
