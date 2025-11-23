import { createContext, useContext, ReactNode } from 'react';
import { APP_CONFIG, AppConfig } from '@/config/app.config';

interface ConfigContextType {
  config: AppConfig;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigContext.Provider value={{ config: APP_CONFIG }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context.config;
}
