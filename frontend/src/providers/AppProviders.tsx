import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from "react";
import { ConversationHistoryItem } from "../api";
interface AppContextType {
  showHistoryPanel: boolean;
  setShowHistoryPanel: Dispatch<SetStateAction<boolean>>;
  dataHistory: ConversationHistoryItem[];
  setDataHistory: Dispatch<SetStateAction<ConversationHistoryItem[]>>;
  userId: string,
  setUserId: Dispatch<SetStateAction<string>>
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [showHistoryPanel, setShowHistoryPanel] = useState<boolean>(false);
  const [dataHistory, setDataHistory] = useState<ConversationHistoryItem[]>([]);
  const [userId, setUserId] = useState<string>("00000000-0000-0000-0000-000000000000");
  


  return (
    <AppContext.Provider value={{ showHistoryPanel, setShowHistoryPanel, dataHistory, setDataHistory, userId, setUserId }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used inside AppProvider");
  }
  return context;
};
