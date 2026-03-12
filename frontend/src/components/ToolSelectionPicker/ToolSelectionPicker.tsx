import React, { useMemo, useRef, useState } from "react";
import styles from "./ToolSelectionPicker.module.css";
import { AnswerIcon } from "../Answer/AnswerIcon";

const TOOL_DISPLAY_NAMES: Record<string, string> = {
    agentic_search: "Agentic Search",
    data_analyst: "Data Analysis",
    trade_sql_query: "Trade Propulse Lookup",
    // Temporarily disabled in UI. Keep mapping for future re-enable.
    other: "Other"
};

const SELECTABLE_TOOLS = ["agentic_search", "data_analyst", "trade_sql_query"];

function getDisplayName(toolName: string): string {
    return TOOL_DISPLAY_NAMES[toolName] ?? toolName;
}

function normalizeToolName(value: string): string {
    return value.trim().toLowerCase();
}

interface Props {
    availableTools: string[];
    recommendation: string;
    onSelect: (toolName: string) => void;
    title?: string;
    question?: string;
    customOptionKey?: string;
    customPlaceholder?: string;
    onCustomQuestionSubmit?: (value: string) => void;
}

export const ToolSelectionPicker: React.FC<Props> = ({
    availableTools,
    recommendation,
    onSelect,
    title,
    question,
    customOptionKey = "other",
    customPlaceholder = "Type your preference...",
    onCustomQuestionSubmit
}) => {
    const firedRef = useRef(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [customQuestion, setCustomQuestion] = useState("");
    const [customSubmitted, setCustomSubmitted] = useState(false);

    const renderedOptions = useMemo(() => {
        const availableSet = new Set(availableTools);
        const tools = SELECTABLE_TOOLS.filter(tool => availableSet.size === 0 || availableSet.has(tool));

        // TEMPORARY: hide "Other" from UI for now.
        // Future re-enable:
        // return [...tools, "other"];
        return tools;
    }, [availableTools]);

    const normalizedRecommendation = useMemo(() => normalizeToolName(recommendation || ""), [recommendation]);

    const hasCustomOption = useMemo(
        () => renderedOptions.some(tool => tool.toLowerCase() === customOptionKey.toLowerCase()),
        [renderedOptions, customOptionKey]
    );

    const customOption = useMemo(() => renderedOptions.find(tool => tool.toLowerCase() === customOptionKey.toLowerCase()), [renderedOptions, customOptionKey]);

    const handleSelect = (toolName: string) => {
        setSelectedOption(toolName);

        if (customOption && toolName.toLowerCase() === customOption.toLowerCase()) {
            return;
        }

        if (firedRef.current) return;
        firedRef.current = true;
        onSelect(toolName);
    };

    const handleSubmitCustom = () => {
        const trimmed = customQuestion.trim();
        if (!trimmed) return;
        setCustomSubmitted(true);
        if (onCustomQuestionSubmit) {
            onCustomQuestionSubmit(trimmed);
        }
    };

    const showCustomInput = hasCustomOption && !!customOption && !!selectedOption && selectedOption.toLowerCase() === customOption.toLowerCase();

    return (
        <div className={styles.container}>
            <div className={styles.headerRow}>
                <AnswerIcon />
                <div className={styles.idea} aria-hidden="true">
                    ?
                </div>
            </div>
            {title && <p className={styles.title}>{title}</p>}
            <p className={styles.prompt}>{question || "Which option would you like me to focus on?"}</p>
            <div className={styles.buttons}>
                {renderedOptions.map(tool => {
                    const isRecommended = normalizeToolName(tool) === normalizedRecommendation;
                    return (
                        <button
                            key={tool}
                            type="button"
                            className={`${styles.toolButton} ${isRecommended ? styles.recommended : ""} ${selectedOption === tool ? styles.selected : ""}`}
                            onClick={() => handleSelect(tool)}
                        >
                            {getDisplayName(tool)}
                            {isRecommended && <span className={styles.recommendationBadge}> Recommended </span>}
                        </button>
                    );
                })}
            </div>
            {/*
                            TEMPORARY: "Other" free-text flow is parked for later integration.
                            Keep this block commented as requested.
                        */}
            {showCustomInput && (
                <div className={styles.customInputRow}>
                    <input
                        className={styles.customInput}
                        type="text"
                        value={customQuestion}
                        onChange={event => {
                            setCustomQuestion(event.target.value);
                            if (customSubmitted) setCustomSubmitted(false);
                        }}
                        placeholder={customPlaceholder}
                    />
                    <button type="button" className={styles.sendButton} onClick={handleSubmitCustom} aria-label="Send custom preference">
                        ➤
                    </button>
                </div>
            )}
            {showCustomInput && customSubmitted && <p className={styles.helper}>Preference captured (UI only).</p>}
        </div>
    );
};
