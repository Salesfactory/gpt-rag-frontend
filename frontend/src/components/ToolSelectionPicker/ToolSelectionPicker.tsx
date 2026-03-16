import React, { useRef, useState } from "react";
import styles from "./ToolSelectionPicker.module.css";
import { AnswerIcon } from "../Answer/AnswerIcon";

interface AnswerOption {
    text: string;
    tool_name: string;
}

interface Props {
    question: string;
    options: AnswerOption[];
    onSelect: (toolName: string, selectedText: string) => void;
}

export const ToolSelectionPicker: React.FC<Props> = ({ question, options, onSelect }) => {
    const firedRef = useRef(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    const handleSelect = (opt: AnswerOption) => {
        if (firedRef.current) return;
        firedRef.current = true;
        setSelectedOption(opt.tool_name);
        onSelect(opt.tool_name, opt.text);
    };

    return (
        <div className={styles.container}>
            <div className={styles.headerRow}>
                <AnswerIcon />
                <div className={styles.idea} aria-hidden="true">?</div>
            </div>
            <p className={styles.prompt}>{question}</p>
            <div className={styles.buttons}>
                {options.map(opt => (
                    <button
                        key={opt.tool_name}
                        type="button"
                        className={`${styles.toolButton} ${selectedOption === opt.tool_name ? styles.selected : ""}`}
                        onClick={() => handleSelect(opt)}
                    >
                        {opt.text}
                    </button>
                ))}
            </div>
        </div>
    );
};
