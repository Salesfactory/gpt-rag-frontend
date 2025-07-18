import React, { useState, useEffect, useRef } from "react";
import { SaveFilled, ErrorCircleFilled } from "@fluentui/react-icons";
import { X } from "lucide-react";
import { TooltipHost, TooltipDelay, DirectionalHint, DefaultButton, Stack, Spinner, Slider, Dropdown, IDropdownOption } from "@fluentui/react";
import styles from "./SettingsModalcopy.module.css";
import { getSettings, postSettings } from "../../api/api";
import { mergeStyles } from "@fluentui/react/lib/Styling";
import { useAppContext } from "../../providers/AppProviders";
import { Dialog, DialogContent, PrimaryButton } from "@fluentui/react";
import { toast, ToastContainer } from "react-toastify";

interface Props {
    user: {
        id: string;
        name: string;
    } | null;
}

const iconClass = mergeStyles({
    fontSize: 25,
    height: 25,
    width: 25,
    margin: "0",
    padding: "5px 0 0 0px",
    cursor: "pointer"
});

const itemClass = mergeStyles({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 0",
    width: "85%"
});

const ConfirmationDialog = ({ loading, isOpen, onDismiss, onConfirm }: { loading: boolean; isOpen: boolean; onDismiss: () => void; onConfirm: () => void }) => {
    return (
        <Dialog
            hidden={!isOpen}
            onDismiss={onDismiss}
            dialogContentProps={{
                type: 0,
                title: "Confirmation",
                subText: "Are you sure you want to save the changes?"
            }}
            modalProps={{
                isBlocking: true,
                styles: { main: { maxWidth: 450 } }
            }}
        >
            {loading ? (
                <div>
                    <Spinner
                        styles={{
                            root: {
                                marginTop: "50px"
                            }
                        }}
                    />
                </div>
            ) : (
                <DialogContent>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: "10px"
                        }}
                    >
                        <DefaultButton onClick={onDismiss} text="Cancel" />
                        <PrimaryButton
                            onClick={() => {
                                onConfirm();
                            }}
                            text="Save"
                            styles={{
                                root: {
                                    backgroundColor: "#16a34a",
                                    borderColor: "#16a34a"
                                },
                                rootHovered: {
                                    backgroundColor: "#15803d",
                                    borderColor: "#15803d"
                                },
                                rootPressed: {
                                    backgroundColor: "#15803d",
                                    borderColor: "#15803d"
                                }
                            }}
                        />
                    </div>
                </DialogContent>
            )}
        </Dialog>
    );
};

interface ChatSettingsProps {
    onClose: () => void;
}

export const SettingsPanel: React.FC<ChatSettingsProps> = ({ onClose }) => {
    const { user, setSettingsPanel, settingsPanel } = useAppContext();

    const [temperature, setTemperature] = useState("0");
    const [selectedModel, setSelectedModel] = useState<string>("DeepSeek-V3-0324");
    const [loading, setLoading] = useState(true);
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [selectedFontSize, setSelectedFontSize] = useState<string>("16");
    const [selectedFont, setSelectedFont] = useState<string>("Arial");

    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const temperatureDialog =
        "It adjusts the balance between creativity and predictability in responses. Lower settings yield straightforward answers, while higher settings introduce originality and diversity, perfect for creative tasks and factual inquiries.";
    const modelDialog = "Select the underlying language model for generating responses.";

    const modelOptions: IDropdownOption[] = [
        { key: "DeepSeek-V3-0324", text: "DeepSeek-V3-0324" },
        { key: "gpt-4.1", text: "gpt-4.1" },
        { key: "Claude-4-Sonnet", text: "Claude-4-Sonnet" }
    ];

    const modelTemperatureSettings: Record<string, { default: number; min: number; max: number; step: number }> = {
        "DeepSeek-V3-0324": { default: 0, min: 0, max: 1.5, step: 0.1 },
        "gpt-4.1": { default: 0, min: 0, max: 1, step: 0.1 },
        "Claude-4-Sonnet": { default: 0, min: 0, max: 1, step: 0.1 }
    };

    const fontSizeOptions = [
        { key: "10", text: "10" },
        { key: "10.5", text: "10.5" },
        { key: "11", text: "11" },
        { key: "12", text: "12" },
        { key: "14", text: "14" },
        { key: "16", text: "16" },
        { key: "18", text: "18" },
        { key: "20", text: "20" },
        { key: "22", text: "22" },
        { key: "24", text: "24" },
        { key: "26", text: "26" },
        { key: "28", text: "28" },
        { key: "36", text: "36" }
    ];

    const fontOptions: IDropdownOption[] = [
        { key: "Arial", text: "Arial" },
        { key: "Helvetica", text: "Helvetica" },
        { key: "Georgia", text: "Georgia" },
        { key: "Times New Roman", text: "Times New Roman" },
        { key: "Verdana", text: "Verdana" },
        { key: "Trebuchet MS", text: "Trebuchet MS" },
        { key: "Courier New", text: "Courier New" },
        { key: "Impact", text: "Impact" },
        { key: "Comic Sans MS", text: "Comic Sans MS" },
        { key: "Tahoma", text: "Tahoma" },
        { key: "Palatino", text: "Palatino" },
        { key: "Lucida Console", text: "Lucida Console" }
    ];

    useEffect(() => {
        const fetchData = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                const data = await getSettings({
                    user: {
                        id: user.id,
                        name: user.name
                    }
                });

                // Temperature
                if (data.temperature === undefined || data.temperature === null) {
                    const modelConfig = modelTemperatureSettings[data.model || "DeepSeek-V3-0324"];
                    setTemperature(modelConfig.default.toString());
                } else {
                    setTemperature(data.temperature);
                }

                // Model
                setSelectedModel(data.model || "DeepSeek-V3-0324");

                // Font Size
                if (typeof data.font_size === "string" && data.font_family.trim() !== "") {
                    setSelectedFontSize(data.font_size.toString());
                }
                // Font Family
                if (typeof data.font_family === "string" && data.font_family.trim() !== "") {
                    setSelectedFont(data.font_family.trim());
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
                const modelConfig = modelTemperatureSettings[selectedModel];
                setTemperature(modelConfig.default.toString());
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const handleSubmit = () => {
        const parsedTemperature = parseFloat(temperature);
        const modelConfig = modelTemperatureSettings[selectedModel];
        const parsedFontSize = selectedFontSize;
        const parsedFontSeleted = selectedFont;

        if (parsedTemperature < modelConfig.min || parsedTemperature > modelConfig.max) {
            console.error(`Invalid temperature for ${selectedModel}. Must be between ${modelConfig.min} and ${modelConfig.max}.`);
            return;
        }

        postSettings({
            user,
            temperature: parsedTemperature,
            model: selectedModel,
            font_family: parsedFontSeleted,
            font_size: parsedFontSize
        })
            .then(data => {
                setTemperature(data.temperature);
                setSelectedModel(data.model);
                setSelectedFont(data.font_family);
                setSelectedFontSize(data.font_size);
                setIsDialogOpen(false);
                setIsLoadingSettings(false);
                toast("Successfully saved data. The page will reload in 2 seconds.", { type: "success" });
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            })
            .catch(error => {
                console.error("Error saving settings:", error);
                setIsLoadingSettings(false);
                toast("Error saving data", { type: "error" });
            });
    };

    const validateValue = (val: any, func: any) => {
        if (val.match(/^[0]+$/)) {
            func("0");
            return false;
        }

        if (val.match(/[^0-9.]/) || val < 0 || val > 1 || val.split(".").length > 2 || val === "1." || val.length > 4) {
            return false;
        }

        return true;
    };

    const handleSetTemperature = (val: any) => {
        const value = String(val);
        if (validateValue(value, setTemperature)) {
            setTemperature(value);
        }
    };

    const onRenderLabel = (dialog: string, title: string) => (
        <TooltipHost
            tooltipProps={{
                onRenderContent: () => (
                    <div>
                        <h3>{title}</h3>
                        {dialog}
                    </div>
                )
            }}
            delay={TooltipDelay.zero}
            directionalHint={DirectionalHint.bottomCenter}
            styles={{ root: { display: "inline-block" } }}
        >
            <ErrorCircleFilled className={iconClass} />
        </TooltipHost>
    );

    const handleClosePanel = () => {
        onClose();
    };

    if (!user) {
        setLoading(false);
        // Display a message or render a different component
        return <div>Please log in to view your settings.</div>;
    }
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [setSettingsPanel]);
    return (
        <div className={styles.overlay}>
            <div ref={panelRef} className={styles.panel} onClick={e => e.stopPropagation()}>
                <ToastContainer />
                <ConfirmationDialog
                    loading={isLoadingSettings}
                    isOpen={isDialogOpen}
                    onDismiss={() => {
                        setIsDialogOpen(false);
                    }}
                    onConfirm={() => {
                        setIsLoadingSettings(true);
                        handleSubmit();
                    }}
                />
                <Stack className={`${styles.answerContainer}`} verticalAlign="space-between">
                    <Stack.Item grow className={styles["w-100"]}>
                        <div className={styles.header2}>
                            <div className={styles.title}>Chat Settings</div>
                            <div className={styles.buttons}>
                                <div></div>
                                <div className={styles.closeButtonContainer}>
                                    <button className={styles.closeButton2} aria-label="hide button" onClick={handleClosePanel}>
                                        <X />
                                    </button>
                                </div>
                            </div>
                        </div>
                        {loading ? (
                            <div>
                                <h3 style={{ textAlign: "center", fontSize: "16px", marginTop: "20px" }}>Loading your settings</h3>
                                <Spinner
                                    styles={{
                                        root: {
                                            marginBottom: "30px"
                                        }
                                    }}
                                />
                            </div>
                        ) : (
                            <div className={styles.content}>
                                <div className={styles["w-100"]}>
                                    <div className={styles.item}>
                                        <span>Font Type</span>
                                    </div>
                                    <Dropdown
                                        placeholder="Select font"
                                        options={fontOptions}
                                        selectedKey={selectedFont}
                                        onChange={(_event, option) => {
                                            if (option) {
                                                setSelectedFont(option.key as string);
                                            }
                                        }}
                                        aria-labelledby="font-dropdown"
                                        onRenderOption={option => <span style={{ fontFamily: option!.text }}>{option!.text}</span>}
                                        onRenderTitle={options => {
                                            if (!options || options.length === 0) return null;
                                            return <span style={{ fontFamily: options[0].text }}>{options[0].text}</span>;
                                        }}
                                        calloutProps={{
                                            directionalHint: 4,
                                            isBeakVisible: false,
                                            styles: {
                                                root: {
                                                    maxHeight: 200,
                                                    overflowY: "auto"
                                                }
                                            }
                                        }}
                                        styles={{
                                            root: {
                                                width: "90%"
                                            },
                                            dropdown: {
                                                borderRadius: "8px",
                                                border: "1px solid #d1d5db",
                                                minHeight: "39px",
                                                backgroundColor: "#ffffff",
                                                outline: "none",
                                                boxShadow: "none"
                                            },
                                            title: {
                                                fontSize: "14px",
                                                paddingLeft: "12px",
                                                paddingRight: "12px",
                                                lineHeight: "37px",
                                                color: "#374151",
                                                border: "0px",
                                                backgroundColor: "transparent"
                                            },
                                            caretDown: {
                                                color: "#6b7280",
                                                fontSize: "12px",
                                                right: "12px"
                                            },
                                            callout: {
                                                borderRadius: "8px",
                                                border: "1px solid #d1d5db",
                                                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
                                            }
                                        }}
                                    />
                                    <div className={styles.item}>
                                        <span>Font Size</span>
                                    </div>
                                    <Dropdown
                                        placeholder="Select font size"
                                        options={fontSizeOptions}
                                        selectedKey={selectedFontSize}
                                        onChange={(_event, option) => {
                                            if (option) {
                                                setSelectedFontSize(option.key as string);
                                            }
                                        }}
                                        aria-labelledby="font-size-dropdown"
                                        calloutProps={{
                                            directionalHint: 4,
                                            isBeakVisible: false,
                                            styles: {
                                                root: {
                                                    maxHeight: 200,
                                                    overflowY: "auto"
                                                }
                                            }
                                        }}
                                        styles={{
                                            root: {
                                                width: "90%"
                                            },
                                            dropdown: {
                                                borderRadius: "8px",
                                                border: "1px solid #d1d5db",
                                                minHeight: "39px",
                                                backgroundColor: "#ffffff",
                                                outline: "none",
                                                boxShadow: "none",
                                                "&:hover": {
                                                    borderColor: "#9ca3af"
                                                },
                                                "&:focus": {
                                                    borderColor: "#3b82f6",
                                                    boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.2)",
                                                    outline: "none",
                                                    borderRadius: "6px"
                                                },
                                                "&:focus-within": {
                                                    borderColor: "#3b82f6",
                                                    boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.2)",
                                                    outline: "none",
                                                    borderRadius: "6px"
                                                },
                                                "&[aria-expanded='true']": {
                                                    borderRadius: "6px"
                                                }
                                            },
                                            title: {
                                                fontSize: "14px",
                                                paddingLeft: "12px",
                                                paddingRight: "12px",
                                                lineHeight: "37px",
                                                color: "#374151",
                                                border: "0px",
                                                backgroundColor: "transparent"
                                            },
                                            caretDown: {
                                                color: "#6b7280",
                                                fontSize: "12px",
                                                right: "12px"
                                            },
                                            callout: {
                                                borderRadius: "8px",
                                                border: "1px solid #d1d5db",
                                                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
                                            }
                                        }}
                                    />
                                    <div className={styles.item}>
                                        <span>Model Selection</span>
                                    </div>
                                    <Dropdown
                                        placeholder="Select a model"
                                        options={modelOptions}
                                        selectedKey={selectedModel}
                                        onChange={(_event, option) => {
                                            if (option) {
                                                setSelectedModel(option.key as string);
                                            }
                                        }}
                                        aria-labelledby="model-dropdown"
                                        styles={{
                                            root: {
                                                width: "90%"
                                            },
                                            dropdown: {
                                                borderRadius: "8px",
                                                border: "1px solid #d1d5db",
                                                minHeight: "39px",
                                                backgroundColor: "#ffffff",
                                                outline: "none",
                                                boxShadow: "none",
                                                "&:hover": {
                                                    borderColor: "#9ca3af"
                                                },
                                                "&:focus": {
                                                    borderColor: "#3b82f6",
                                                    boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.2)",
                                                    outline: "none",
                                                    borderRadius: "6px"
                                                },
                                                "&:focus-within": {
                                                    borderColor: "#3b82f6",
                                                    boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.2)",
                                                    outline: "none",
                                                    borderRadius: "6px"
                                                },
                                                "&[aria-expanded='true']": {
                                                    borderRadius: "6px"
                                                }
                                            },
                                            title: {
                                                fontSize: "14px",
                                                paddingLeft: "12px",
                                                paddingRight: "12px",
                                                lineHeight: "37px",
                                                color: "#374151",
                                                border: "0px",
                                                backgroundColor: "transparent"
                                            },
                                            caretDown: {
                                                color: "#6b7280",
                                                fontSize: "12px",
                                                right: "12px"
                                            },
                                            callout: {
                                                borderRadius: "8px",
                                                border: "1px solid #d1d5db",
                                                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
                                            }
                                        }}
                                    />
                                </div>
                                <div className={styles["w-100"]}>
                                    <div className={styles.item}>
                                        <span>Creativity Scale</span>
                                    </div>
                                    <div className={styles.sliderContainer}>
                                        <Slider
                                            label=""
                                            min={modelTemperatureSettings[selectedModel].min}
                                            max={modelTemperatureSettings[selectedModel].max}
                                            step={modelTemperatureSettings[selectedModel].step}
                                            value={parseFloat(temperature)}
                                            showValue
                                            snapToStep
                                            onChange={e => setTemperature(e.toString())}
                                            aria-labelledby="temperature-slider"
                                            styles={{
                                                root: { width: "90%" }
                                            }}
                                            className={styles.sliderCustom}
                                        />
                                    </div>
                                </div>

                                <div className={styles["w-100"]} style={{ marginTop: "30px", textAlign: "center" }}>
                                    <DefaultButton className={styles.saveButton} onClick={() => setIsDialogOpen(true)} aria-label="Save settings">
                                        <SaveFilled className={styles.saveIcon} />
                                        &#8202;&#8202;Save
                                    </DefaultButton>
                                </div>
                            </div>
                        )}
                    </Stack.Item>
                </Stack>
            </div>
        </div>
    );
};
