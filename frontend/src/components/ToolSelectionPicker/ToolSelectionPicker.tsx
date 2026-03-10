import React, { useRef } from "react";
import styles from "./ToolSelectionPicker.module.css";

const TOOL_DISPLAY_NAMES: Record<string, string> = {
    agentic_search: "Agentic Search",
    data_analyst: "Data Analysis",
    document_chat: "Document Chat",
    trade_sql_query: "Trade Propulse Lookup",
};

function getDisplayName(toolName: string): string {
    return TOOL_DISPLAY_NAMES[toolName] ?? toolName;
}

interface Props {
    availableTools: string[];
    recommendation: string;
    onSelect: (toolName: string) => void;
}

export const ToolSelectionPicker: React.FC<Props> = ({ availableTools, recommendation, onSelect }) => {
    const firedRef = useRef(false);

    const handleSelect = (toolName: string) => {
        if (firedRef.current) return;
        firedRef.current = true;
        onSelect(toolName);
    };

    return (
        <div className={styles.container}>
            <p className={styles.prompt}>Which tool should I use?</p>
            <div className={styles.buttons}>
                {availableTools.map(tool => (
                    <button
                        key={tool}
                        className={`${styles.toolButton} ${tool === recommendation ? styles.recommended : ""}`}
                        onClick={() => handleSelect(tool)}
                    >
                        {getDisplayName(tool)}
                        {tool === recommendation && (
                            <span className={styles.badge}>Recommended</span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};
