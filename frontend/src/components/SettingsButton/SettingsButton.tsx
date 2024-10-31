import { Text, DefaultButton } from "@fluentui/react";
import { SettingsRegular } from "@fluentui/react-icons";

import styles from "./SettingsButton.module.css";

interface Props {
    onClick: () => void;
}

export const SettingsButton = ({ onClick }: Props) => {
    return (
        <DefaultButton onClick={onClick} className={styles.button}>
            <SettingsRegular />
            <Text className={styles.buttonText}>Settings</Text>
        </DefaultButton>
    );
};
