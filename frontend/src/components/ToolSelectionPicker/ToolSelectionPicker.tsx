import React, { useRef, useState } from "react";
import { Send } from "lucide-react";
import styles from "./ToolSelectionPicker.module.css";
import { AnswerIcon } from "../Answer/AnswerIcon";
import type { ClarificationOption, HitlType } from "../../pages/chat/streamParser";

interface Props {
    question: string;
    options: ClarificationOption[];
    hitlType?: HitlType;
    onSelect: (selectedText: string, toolName?: string) => void;
}

export const ToolSelectionPicker: React.FC<Props> = ({ question, options, hitlType, onSelect }) => {
    const firedRef = useRef(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customText, setCustomText] = useState("");

    const showOtherOption = hitlType === "intention_clarification";

    const handleSelect = (opt: ClarificationOption) => {
        if (firedRef.current) return;
        firedRef.current = true;
        const key = opt.tool_name ?? opt.text;
        setSelectedOption(key);
        onSelect(opt.text, opt.tool_name);
    };

    const handleOtherClick = () => {
        if (firedRef.current) return;
        setSelectedOption("__other__");
        setShowCustomInput(true);
    };

    const handleCustomSubmit = () => {
        const trimmed = customText.trim();
        if (!trimmed || firedRef.current) return;
        firedRef.current = true;
        onSelect(trimmed);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleCustomSubmit();
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.headerRow}>
                <AnswerIcon />
                <div className={styles.idea} aria-hidden="true">?</div>
            </div>
            <p className={styles.prompt}>{question}</p>
            <div className={styles.buttons}>
                {options.map((opt, idx) => {
                    const key = opt.tool_name ?? `opt-${idx}`;
                    return (
                        <button
                            key={key}
                            type="button"
                            className={`${styles.toolButton} ${selectedOption === (opt.tool_name ?? opt.text) ? styles.selected : ""}`}
                            onClick={() => handleSelect(opt)}
                            disabled={showCustomInput}
                        >
                            {opt.text}
                        </button>
                    );
                })}
                {showOtherOption && (
                    <button
                        type="button"
                        className={`${styles.toolButton} ${selectedOption === "__other__" ? styles.selected : ""}`}
                        onClick={handleOtherClick}
                        disabled={showCustomInput}
                    >
                        Other
                    </button>
                )}
            </div>
            {showCustomInput && (
                <div className={styles.customInputRow}>
                    <input
                        className={styles.customInput}
                        type="text"
                        placeholder="Type your preference..."
                        value={customText}
                        onChange={e => setCustomText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                    <button
                        type="button"
                        className={styles.sendButton}
                        onClick={handleCustomSubmit}
                        disabled={!customText.trim()}
                        aria-label="Send custom preference"
                    >
                        <Send size={18} />
                    </button>
                </div>
            )}
        </div>
    );
};
