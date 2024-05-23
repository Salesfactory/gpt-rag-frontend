import React, { useState, useEffect, useCallback } from "react";
import { AddFilled, SaveFilled, ErrorCircleFilled } from "@fluentui/react-icons";
import { Checkbox } from "@fluentui/react/lib/Checkbox";
import { TooltipHost, TooltipDelay, DirectionalHint, DefaultButton, Modal, Stack, Text, Spinner, Slider } from "@fluentui/react";
import styles from "./SettingsModal.module.css";
import { getSettings, postSettings } from "../../api/api";
import { mergeStyles } from "@fluentui/react/lib/Styling";
import { useAppContext } from "../../providers/AppProviders";
import { ProfileButton } from "../Profile";

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
    padding: "10px 0"
});

export const SettingsPanel = () => {
    const { user, setSettingsPanel } = useAppContext();

    const [temperature, setTemperature] = useState("0");
    const [loading, setLoading] = useState(true);

    const temperatureDialog =
        "It adjusts the balance between creativity and predictability in responses. Lower settings yield straightforward answers, while higher settings introduce originality and diversity, perfect for creative tasks and factual inquiries.";

    useEffect(() => {
        const fetchData = async () => {
            getSettings({
                user: {
                    id: user.id,
                    name: user.name
                }
            })
                .then(data => {
                    setTemperature(data.temperature);
                    setLoading(false);
                })
                .catch(error => setLoading(false));
        };

        setLoading(true);
        fetchData();
    }, []);

    const handleSubmit = () => {
        const parsedTemperature = parseFloat(temperature);

        if (parsedTemperature < 0 || parsedTemperature > 1) {
            console.error("Invalid, settings are not submitted.");
            return;
        }

        postSettings({
            user,
            temperature: parsedTemperature
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

    return (
        <div>
            <Stack className={`${styles.answerContainer}`} verticalAlign="space-between">
                <Stack.Item grow className={styles["w-100"]}>
                    <div className={styles.header2}>
                        <div className={styles.title}>Configuration</div>
                        <div className={styles.buttons}>
                            <div></div>
                            <div className={styles.closeButtonContainer}>
                                <button className={styles.closeButton2} aria-label="hide button" onClick={handleClosePanel}>
                                    <AddFilled />
                                </button>
                            </div>
                        </div>
                    </div>
                    {loading ? (
                        <div>
                            <Spinner
                                styles={{
                                    root: {
                                        marginTop: "50px"
                                    }
                                }}
                            />
                            <h3 style={{ textAlign: "center" }}>Loading your settings</h3>
                        </div>
                    ) : (
                        <div className={styles["w-100"]}>
                            <div className={styles["w-100"]}>
                                <div className={itemClass}>
                                    <span>Creativity Scale</span>
                                    {onRenderLabel(temperatureDialog, "Temperature")}
                                </div>
                                <Slider
                                    className={styles["w-100"]}
                                    label=""
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    value={parseFloat(temperature)}
                                    showValue
                                    snapToStep
                                    onChange={e => handleSetTemperature(e)}
                                />
                            </div>
                            <DefaultButton className={styles.saveButton} onClick={handleSubmit}>
                                <SaveFilled />
                                &#8202;&#8202;Save
                            </DefaultButton>
                        </div>
                    )}
                </Stack.Item>
            </Stack>
            <div className={styles.profileButtonContainer}>
                <ProfileButton />
            </div>
        </div>
    );
};
