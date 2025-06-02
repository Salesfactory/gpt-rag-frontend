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
                        />
                    </div>
                </DialogContent>
            )}
        </Dialog>
    );
};

export const SettingsPanel = () => {
    const { user, setSettingsPanel, settingsPanel } = useAppContext();

    const [temperature, setTemperature] = useState("0");
    const [selectedModel, setSelectedModel] = useState<string>("DeepSeek-V3-0324");
    const [loading, setLoading] = useState(true);
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);

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

    useEffect(() => {
        const fetchData = async () => {
            if (!user) {
                // User is not logged in; handle accordingly
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
                
                // Only use model-specific default if no temperature is saved at all (undefined/null)
                if (data.temperature === undefined || data.temperature === null) {
                    const modelConfig = modelTemperatureSettings[data.model || "DeepSeek-V3-0324"];
                    setTemperature(modelConfig.default.toString());
                } else {
                    // Use saved temperature even if it's "0" (user explicitly set it)
                    setTemperature(data.temperature);
                }
                
                setSelectedModel(data.model || "DeepSeek-V3-0324");
            } catch (error) {
                console.error("Error fetching settings:", error);
                // Set default values when there's an error fetching settings
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

        if (parsedTemperature < modelConfig.min || parsedTemperature > modelConfig.max) {
            console.error(`Invalid temperature for ${selectedModel}. Must be between ${modelConfig.min} and ${modelConfig.max}.`);
            return;
        }

        postSettings({
            user,
            temperature: parsedTemperature,
            model: selectedModel
        })
            .then(data => {
                setTemperature(data.temperature);
                setSelectedModel(data.model);
                setIsDialogOpen(false);
                setIsLoadingSettings(false);
                toast("Successfully saved data", { type: "success" });
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
        setSettingsPanel(false);
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
                setSettingsPanel(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [setSettingsPanel]);

    return (
        <div ref={panelRef} className={styles.overlay}>
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
                        <div className={styles.title}>Model Settings</div>
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
    );
};
