import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "gpl";

const STORAGE_KEY = "bim-audit-theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "gpl";
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark" || stored === "gpl") return stored;
  return "gpl"; /* Tema GPL é o padrão do site */
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    // Remover todas as classes de tema
    root.classList.remove("dark", "gpl");
    // Adicionar classe do tema atual
    if (theme === "dark") root.classList.add("dark");
    else if (theme === "gpl") root.classList.add("gpl");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (value: Theme) => setThemeState(value);
  const toggleTheme = () => {
    setThemeState((t) => {
      if (t === "light") return "dark";
      if (t === "dark") return "gpl";
      return "light";
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
