import React, { useState, useEffect, useRef } from "react";
import { SaveFilled } from "@fluentui/react-icons";
import { X, Info, FileText, AlignLeft, BookOpen } from "lucide-react";
import { DefaultButton, Stack, Spinner, Slider, Dropdown, IDropdownOption, Dialog, DialogContent, PrimaryButton } from "@fluentui/react";
import styles from "./SettingsModalcopy.module.css";
import { getSettings, postSettings } from "../../api/api";
import { useAppContext } from "../../providers/AppProviders";
import { toast } from "react-toastify";

type DetailLevel = "brief" | "balanced" | "detailed";

const ConfirmationDialog = ({
  loading,
  isOpen,
  onDismiss,
  onConfirm
}: {
  loading: boolean;
  isOpen: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
}) => {
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
        styles: { main: { maxWidth: 450, borderRadius: "8px" } }
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
            <DefaultButton onClick={onDismiss} text="Cancel" styles={{ root: { borderRadius: "8px" } }} />
            <PrimaryButton
              onClick={onConfirm}
              data-testid="confirm-save"
              text="Save"
              styles={{
                root: { backgroundColor: "#A0CB06", borderColor: "#A0CB06", borderRadius: "8px" },
                rootHovered: { backgroundColor: "#8eb134", borderColor: "#8eb134" },
                rootPressed: { backgroundColor: "#8eb134", borderColor: "#8eb134" }
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
  const { user } = useAppContext();

  const [temperature, setTemperature] = useState<number>(0);
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4.1");
  const [loading, setLoading] = useState(true);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [selectedFontSize, setSelectedFontSize] = useState<string>("16");
  const [selectedFont, setSelectedFont] = useState<string>("Arial");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 520);

  const [detailLevel, setDetailLevel] = useState<DetailLevel>("balanced");

  const modelOptions: IDropdownOption[] = [
    { key: "gpt-4.1", text: "gpt-4.1" },
    { key: "Claude-4.5-Sonnet", text: "Claude-4.5-Sonnet" }
  ];

  const modelTemperatureSettings: Record<
    string,
    { default: number; min: number; max: number; step: number }
  > = {
    "gpt-4.1": { default: 0, min: 0, max: 1, step: 0.1 },
    "Claude-4.5-Sonnet": { default: 0, min: 0, max: 1, step: 0.1 }
  };

  const fontSizeOptions: IDropdownOption[] = [
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
          user: { id: user.id, name: user.name }
        });

        const model = data.model || "gpt-4.1";
        // If the saved model doesn't exist in our settings, default to gpt-4.1
        const validModel = modelTemperatureSettings[model] ? model : "gpt-4.1";
        setSelectedModel(validModel);

        const modelConfig = modelTemperatureSettings[validModel];
        if (data.temperature === undefined || data.temperature === null) {
          setTemperature(Number(modelConfig.default));
        } else {
          setTemperature(Number(data.temperature));
        }

        if (typeof data.font_size === "string" && data.font_size.trim() !== "") {
          setSelectedFontSize(data.font_size.toString());
        }
        if (typeof data.font_family === "string" && data.font_family.trim() !== "") {
          setSelectedFont(data.font_family.trim());
        }
      const detail_level = (data as any)?.detail_level;
      if (detail_level === "brief" || detail_level === "balanced" || detail_level === "detailed") {
        setDetailLevel(detail_level);
      } else {
        setDetailLevel("balanced");
      }
      } catch (error) {
        console.error("Error fetching settings:", error);
        const modelConfig = modelTemperatureSettings[selectedModel];
        setTemperature(Number(modelConfig.default));
        setDetailLevel("balanced");
      } finally {
        setLoading(false);
      }
    };



    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSubmit = () => {
    const parsedTemperature = temperature;
    const modelConfig = modelTemperatureSettings[selectedModel];
    const parsedFontSize = selectedFontSize;
    const parsedFontSeleted = selectedFont;

    if (!modelConfig || parsedTemperature < modelConfig.min || parsedTemperature > modelConfig.max) {
      console.error(
        `Invalid temperature for ${selectedModel}. Must be between ${modelConfig?.min} and ${modelConfig?.max}.`
      );
      return;
    }
    
    postSettings({
      user,
      temperature: parsedTemperature,
      model: selectedModel,
      font_family: parsedFontSeleted,
      font_size: parsedFontSize,
      detail_level: detailLevel
    })
      .then(data => {
        setTemperature(Number(data.temperature));
        setSelectedModel(data.model);
        setSelectedFont(data.font_family);
        setSelectedFontSize(data.font_size);

        const returned = (data as any)?.detail_level;
        const normalized: DetailLevel =
          returned === "brief" || returned === "balanced" || returned === "detailed"
            ? returned
            : detailLevel;

        setDetailLevel(normalized);
        try {
          localStorage.setItem("chat_creativity", String(data.temperature));
          localStorage.setItem("detail_level", normalized);
        } catch {}
        setIsDialogOpen(false);
        setIsLoadingSettings(false);
        toast("Settings saved. Creativity will apply to new messages.", { type: "success" });
        onClose();
      })
      .catch(error => {
        console.error("Error saving settings:", error);
        setIsLoadingSettings(false);
        toast("Error saving data", { type: "error" });
      });
  };

  const InfoTooltip: React.FC<{ title: string }> = ({ title }) => {
    const [open, setOpen] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const wrapperRef = useRef<HTMLSpanElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);

    const calculatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const tooltipWidth = 300;
        setTooltipPosition({
          top: rect.bottom + 6,
          left: rect.left + rect.width / 2 - tooltipWidth / 2 + 110
        });
      }
    };

    useEffect(() => {
      const handleDocClick = (e: MouseEvent) => {
        if (!wrapperRef.current) return;
        if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
      };
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("mousedown", handleDocClick);
      document.addEventListener("keydown", handleEsc);
      return () => {
        document.removeEventListener("mousedown", handleDocClick);
        document.removeEventListener("keydown", handleEsc);
      };
    }, []);

    useEffect(() => {
      calculatePosition();
      let timeoutId: NodeJS.Timeout;
      const handleResize = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(calculatePosition, 150);
      };
      window.addEventListener("resize", handleResize);
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener("resize", handleResize);
      };
    }, []);

    useEffect(() => {
      if (open) {
        calculatePosition();
      }
    }, [open]);

    return (
      <span ref={wrapperRef} className={`${styles.tooltipWrapper} ${open ? styles.tooltipOpen : ""}`} aria-label={`${title} info`}>
        <button
          ref={buttonRef}
          type="button"
          className={`${styles.infoButton} ${open ? styles.infoButtonActive : ""}`}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen(v => !v)}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(v => !v);
            }
          }}
        >
          <Info size={20} className={styles.infoIcon} aria-hidden="true" />
        </button>
        <div
          className={styles.tooltipBoxLarge}
          role="dialog"
          aria-modal="false"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`
          }}
        >
          <div className={styles.scaleGrid}>
            <div>
              <div className={styles.scaleItemHeader}>
                <span className={`${styles.scaleDot} ${styles.dotGray}`} />
                <span className={styles.scaleTitle}>Factual</span>
              </div>
              <div className={styles.scaleRange}>0.0–0.1</div>
              <div className={styles.scaleDesc}>Highly consistent and predictable output</div>
            </div>
            <div>
              <div className={styles.scaleItemHeader}>
                <span className={`${styles.scaleDot} ${styles.dotGrayLight}`} />
                <span className={styles.scaleTitle}>Professional</span>
              </div>
              <div className={styles.scaleRange}>0.2–0.3</div>
              <div className={styles.scaleDesc}>Structured responses for business contexts</div>
            </div>
            <div>
              <div className={styles.scaleItemHeader}>
                <span className={`${styles.scaleDot} ${styles.dotGreenLight}`} />
                <span className={styles.scaleTitle}>Conversational</span>
              </div>
              <div className={styles.scaleRange}>0.4–0.5</div>
              <div className={styles.scaleDesc}>Natural, engaging dialogue for exploration</div>
            </div>
            <div>
              <div className={styles.scaleItemHeader}>
                <span className={`${styles.scaleDot} ${styles.dotGreen}`} />
                <span className={styles.scaleTitle}>Creative</span>
              </div>
              <div className={styles.scaleRange}>0.6+</div>
              <div className={styles.scaleDesc}>Diverse and innovative responses</div>
            </div>
          </div>
        </div>
      </span>
    );
  };

  const handleSetTemperature = (val: number) => {
    if (Number.isNaN(val)) return;
    setTemperature(val);
  };

  const handleClosePanel = () => {
    onClose();
  };

  if (!user) {
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
  }, [onClose]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth <= 520);
      }, 150);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className={styles.overlay} data-testid="settings-overlay">
      <div ref={panelRef} className={styles.panel} onClick={e => e.stopPropagation()}>
        <ConfirmationDialog
          loading={isLoadingSettings}
          isOpen={isDialogOpen}
          onDismiss={() => setIsDialogOpen(false)}
          onConfirm={() => {
            setIsLoadingSettings(true);
            handleSubmit();
          }}
        />

        <Stack className={styles.answerContainer} verticalAlign="space-between">
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
                <Spinner styles={{ root: { marginBottom: "30px" } }} />
              </div>
            ) : (
              <div className={styles.content}>
                <div>
                  <div className={styles.item}>
                    <span>Font Type</span>
                  </div>
                  <Dropdown
                    placeholder="Select font"
                    options={fontOptions}
                    selectedKey={selectedFont}
                    onChange={(_event, option) => option && setSelectedFont(option.key as string)}
                    aria-labelledby="font-dropdown"
                    onRenderOption={option => <span style={{ fontFamily: option!.text }}>{option!.text}</span>}
                    onRenderTitle={options => {
                      if (!options || options.length === 0) return null;
                      return <span style={{ fontFamily: options[0].text }}>{options[0].text}</span>;
                    }}
                    calloutProps={{
                      directionalHint: 4,
                      isBeakVisible: false,
                      doNotLayer: false,
                      preventDismissOnScroll: true,
                      styles: { root: { zIndex: 100000 } }
                    }}
                    styles={{
                      root: { width: "100%" },
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
                      caretDown: { color: "#6b7280", fontSize: "12px", right: "12px" },
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
                    onChange={(_event, option) => option && setSelectedFontSize(option.key as string)}
                    aria-labelledby="font-size-dropdown"
                    calloutProps={{
                      directionalHint: 4,
                      isBeakVisible: false,
                      doNotLayer: false,
                      preventDismissOnScroll: true,
                      styles: { root: { zIndex: 100000 } }
                    }}
                    styles={{
                      root: { width: "100%" },
                      dropdown: {
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        minHeight: "39px",
                        backgroundColor: "#ffffff",
                        outline: "none",
                        boxShadow: "none",
                        "&:hover": { borderColor: "#9ca3af" },
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
                        "&[aria-expanded='true']": { borderRadius: "6px" }
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
                      caretDown: { color: "#6b7280", fontSize: "12px", right: "12px" },
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
                    onChange={(_event, option) => option && setSelectedModel(option.key as string)}
                    aria-labelledby="model-dropdown"
                    calloutProps={{
                      directionalHint: 4,
                      isBeakVisible: false,
                      doNotLayer: false,
                      preventDismissOnScroll: true,
                      styles: { root: { zIndex: 100000 } }
                    }}
                    styles={{
                      root: { width: "100%" },
                      dropdown: {
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        minHeight: "39px",
                        backgroundColor: "#ffffff",
                        outline: "none",
                        boxShadow: "none",
                        "&:hover": { borderColor: "#9ca3af" },
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
                        "&[aria-expanded='true']": { borderRadius: "6px" }
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
                      caretDown: { color: "#6b7280", fontSize: "12px", right: "12px" },
                      callout: {
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
                      }
                    }}
                  />
                </div>

                <div>
                  <div className={styles.item}>
                    <span>Creativity Scale</span>
                    <InfoTooltip title="Creativity Scale" />
                  </div>
                  <div className={styles.sliderContainer}>
                    <Slider
                      label=""
                      min={modelTemperatureSettings[selectedModel].min}
                      max={modelTemperatureSettings[selectedModel].max}
                      step={modelTemperatureSettings[selectedModel].step}
                      value={temperature}
                      showValue
                      snapToStep
                      onChange={handleSetTemperature}
                      aria-labelledby="temperature-slider"
                      styles={{
                        root: { width: "100%" },
                        slideBox: { width: "100%" },
                        valueLabel: { marginLeft: 8, minWidth: "auto" }
                      }}
                      className={styles.sliderCustom}
                    />
                  </div>
                </div>

                {/* Detail Level */}
                <div className={styles.item}>
                  <span>Detail Level</span>
                </div>
                <div
                  role="group"
                  aria-label="Detail Level"
                  className={styles.segmentedGroup}
                  data-testid="detail-level-group"
                >
                  <div
                    className={styles.slidingIndicator}
                    style={
                      isMobile
                        ? {
                            transform:
                              detailLevel === "brief"
                                ? "translateY(0)"
                                : detailLevel === "balanced"
                                ? "translateY(calc(100% + 8px))"
                                : "translateY(calc(200% + 16px))"
                          }
                        : {
                            width: "calc((100% - 16px) / 3)",
                            transform:
                              detailLevel === "brief"
                                ? "translateX(0%)"
                                : detailLevel === "balanced"
                                ? "translateX(calc(100% + 8px))"
                                : "translateX(calc(200% + 16px))"
                          }
                    }
                  />
                  <button
                    type="button"
                    data-testid="detail-opt-succinct"
                    className={`${styles.segmentBtn} ${detailLevel === "brief" ? styles.segmentBtnActive : ""}`}
                    aria-pressed={detailLevel === "brief"}
                    onClick={() => setDetailLevel("brief")}
                  >
                    <FileText className={styles.segmentIcon} aria-hidden="true" />
                    <span className={styles.segmentTitle}>Succinct</span>
                    <span className={styles.segmentSub}>Brief overview</span>
                  </button>

                  <button
                    type="button"
                    data-testid="detail-opt-balanced"
                    className={`${styles.segmentBtn} ${detailLevel === "balanced" ? styles.segmentBtnActive : ""}`}
                    aria-pressed={detailLevel === "balanced"}
                    onClick={() => setDetailLevel("balanced")}
                  >
                    <AlignLeft className={styles.segmentIcon} aria-hidden="true" />
                    <span className={styles.segmentTitle}>Balanced</span>
                    <span className={styles.segmentSub}>Moderate depth</span>
                  </button>

                  <button
                    type="button"
                    data-testid="detail-opt-detailed"
                    className={`${styles.segmentBtn} ${detailLevel === "detailed" ? styles.segmentBtnActive : ""}`}
                    aria-pressed={detailLevel === "detailed"}
                    onClick={() => setDetailLevel("detailed")}
                  >
                    <BookOpen className={styles.segmentIcon} aria-hidden="true" />
                    <span className={styles.segmentTitle}>Detailed</span>
                    <span className={styles.segmentSub}>Comprehensive</span>
                  </button>
                </div>


                <div className={styles.saveRow}>
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
