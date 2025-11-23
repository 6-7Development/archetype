import { type ReactNode } from "react";
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: "dark" | "light";
};

export function ThemeProvider({
  children,
  defaultTheme = "light",
}: ThemeProviderProps) {
  return (
    <NextThemesProvider 
      attribute="class" 
      defaultTheme={defaultTheme}
      enableSystem={false}
      storageKey="ide-theme"
    >
      {children}
    </NextThemesProvider>
  );
}

export const useTheme = () => {
  const context = useNextTheme();
  return {
    theme: context.theme as "dark" | "light",
    setTheme: (theme: "dark" | "light") => context.setTheme(theme),
  };
};
