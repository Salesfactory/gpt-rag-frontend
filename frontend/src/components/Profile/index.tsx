import React, { useState, useEffect } from "react";
import { Dropdown, DropdownMenuItemType, IDropdownOption, IDropdown } from "@fluentui/react/lib/Dropdown";
import { Icon } from "@fluentui/react/lib/Icon";
import { IStackTokens, Stack } from "@fluentui/react/lib/Stack";
import { useAppContext } from "../../providers/AppProviders";
import styles from "./Profile.module.css";
import person from "../../assets/person.png";

const stackTokens: IStackTokens = { childrenGap: 20 };
const iconStyles = { marginRight: "8px" };

const onRenderOption = (option: any): JSX.Element => {
    return (
        <div>
            {option.data && option.data.icon && <Icon style={iconStyles} iconName={option.data.icon} aria-hidden="true" title={option.data.icon} />}
            <span>{option.text}</span>
        </div>
    );
};

// const onRenderTitle = (options: IDropdownOption[]): JSX.Element => {
//     const option = options[0];
//     return (
//         <div className={styles.dropdownTitle}>
//             {option.data && option.data.icon && <Icon style={iconStyles} iconName={option.data.icon} aria-hidden="true" title={option.data.icon} />}
//             <span>{option.text}</span>
//         </div>
//     );
// };

const onRenderCaretDown = (): JSX.Element => {
    return <></>;
    // return <Icon iconName="CirclePlus" />;
};

const onRenderPlaceholder = (props: any): JSX.Element => {
    return (
        <div className={styles.dropdownPlaceholder}>
            <img className={styles.contactImage} src={person} />
            <div className={styles.placeholderSeparator}>&nbsp; &nbsp;</div>
            <span className={styles.dropdownPlaceholderTitle}>{props.placeholder}</span>
        </div>
    );
};

const placeholderPrepare = (placeholder: string) => {
    // remove email domain
    const email = placeholder.split("@")[0];
    // remove special characters
    return email.replace(/[^a-zA-Z0-9]/g, "");
};

export const ProfileButton: React.FunctionComponent = () => {
    const { user } = useAppContext();

    const placeholder = placeholderPrepare(user.name);

    const headerTitle = user.name;

    const options: IDropdownOption[] = [
        { key: "Header", text: headerTitle || "Options", itemType: DropdownMenuItemType.Header },
        { key: "Admin", text: "Admin Panel", data: { icon: "SecurityGroup" } },
        { key: "Logout", text: "Logout", data: { icon: "SkypeArrow" } }
    ];

    const dropdownRef = React.createRef<IDropdown>();
    const onSetFocus = () => dropdownRef.current!.focus(true);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    const clearOption = () => {
        setSelectedOption(null);
        onSetFocus();
    };

    const onSelectOption = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption, index?: number) => {
        const selOption = option?.key.toString() ?? null;
        setSelectedOption(selOption);

        if (selOption === "Logout") {
            // retrieve all cookies
            var Cookies = document.cookie.split(";");
            // set past expiry to all cookies
            for (var i = 0; i < Cookies.length; i++) {
                document.cookie = Cookies[i] + "=; expires=" + new Date(0).toUTCString();
            }
            window.location.reload();
        } else if (selOption === "Admin") {
            // go to admin panel
            console.log("Admin Panel");
        }
    };

    return (
        <Stack tokens={stackTokens} className={styles.stackDropdown}>
            <Dropdown
                componentRef={dropdownRef}
                placeholder={placeholder}
                onRenderPlaceholder={onRenderPlaceholder}
                // onRenderTitle={onRenderTitle}
                onRenderOption={onRenderOption}
                onRenderCaretDown={onRenderCaretDown}
                options={options}
                className={styles.dropdown}
                onChange={onSelectOption}
                // style={selectedOption ? { display: "none" } : {}}
                selectedKeys={selectedOption ? [selectedOption] : []}
            />
        </Stack>
    );
};
