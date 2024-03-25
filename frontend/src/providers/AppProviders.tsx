import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from "react";

// Definimos el tipo para el contexto
interface AppContextType {
  showHistoryPanel: boolean;
  setShowHistoryPanel: Dispatch<SetStateAction<boolean>>;
}

// Creamos el contexto
const AppContext = createContext<AppContextType | undefined>(undefined);

// Proveedor del contexto
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [showHistoryPanel, setShowHistoryPanel] = useState<boolean>(false);

  return (
    <AppContext.Provider value={{ showHistoryPanel, setShowHistoryPanel }}>
      {children}
    </AppContext.Provider>
  );
};

// Hook personalizado para consumir el contexto
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp debe ser utilizado dentro de un AppProvider");
  }
  return context;
};
