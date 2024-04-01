import React, { useState, useEffect } from "react";
import { SettingsFilled, SaveFilled } from "@fluentui/react-icons";
import styles from "./SettingsModal.module.css";
import { getSettings, postSettings } from "../../api/api";

import { DefaultButton, Modal, Stack, Text, TextField, Spinner } from "@fluentui/react";

interface Props {
    user: {
        id: string;
        name: string;
    } | null;
}

const SettingsModal = ({ user }: Props) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [temperature, setTemperature] = useState("");
    const [presencePenalty, setPresencePenalty] = useState("");
    const [frequencyPenalty, setFrequencyPenalty] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            getSettings({ user }).then(data => {
                setTemperature(data.temperature);
                setPresencePenalty(data.presencePenalty);
                setFrequencyPenalty(data.frequencyPenalty);
                setLoading(false);
            });
        };

        setLoading(true);
        fetchData();
    }, [user]);

    const showModal = () => {
        setIsModalOpen(true);
    };

    const hideModal = () => {
        setIsModalOpen(false);
    };

    const handleSubmit = () => {
        if (!temperature || !presencePenalty || !frequencyPenalty) {
            return;
        }

        const parsedTemperature = parseFloat(temperature);
        const parsedPresencePenalty = parseFloat(presencePenalty);
        const parsedFrequencyPenalty = parseFloat(frequencyPenalty);

        postSettings({
            user,
            temperature: parsedTemperature,
            presence_penalty: parsedPresencePenalty,
            frequency_penalty: parsedFrequencyPenalty
        });

        hideModal();
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
        if (validateValue(val.target.value, setTemperature)) {
            setTemperature(val.target.value);
        }
    };

    const handleSetPresencePenalty = (val: any) => {
        if (validateValue(val.target.value, setPresencePenalty)) {
            setPresencePenalty(val.target.value);
        }
    };

    const handleSetFrequencyPenalty = (val: any) => {
        if (validateValue(val.target.value, setFrequencyPenalty)) {
            setFrequencyPenalty(val.target.value);
        }
    };

    return (
        <div>
            <DefaultButton onClick={showModal} className={styles.button}>
                <SettingsFilled />
                <Text className={styles.buttonText}>Settings</Text>
            </DefaultButton>

            <Modal isOpen={isModalOpen} onDismiss={hideModal} isBlocking>
                <Stack className={`${styles.answerContainer}`} verticalAlign="space-between">
                    <Stack.Item grow>
                        <div className="header">
                            <h2>Adjust your settings</h2>
                            <DefaultButton onClick={hideModal} className={styles.closeButton}>
                                &#10006;
                            </DefaultButton>
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
                            <div>
                                <TextField label="Temperature" value={temperature} onChange={e => handleSetTemperature(e)} />
                                <TextField label="Frequency Penalty" value={frequencyPenalty} onChange={e => handleSetFrequencyPenalty(e)} />
                                <TextField label="Presence Penalty" value={presencePenalty} onChange={e => handleSetPresencePenalty(e)} />
                                <DefaultButton className={styles.saveButton} onClick={handleSubmit}>
                                    <SaveFilled />
                                    &#8202;&#8202;Save
                                </DefaultButton>
                            </div>
                        )}
                    </Stack.Item>
                </Stack>
            </Modal>
        </div>
    );
};

export default SettingsModal;
