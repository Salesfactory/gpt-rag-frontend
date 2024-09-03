import { useState, useContext } from "react";
import salesLogo from "../../img/logo.png";
import isotipo from "../../img/isotipo.png";
import styles from "./SideMenu.module.css";
import { Link } from "react-router-dom";
import { AppContext } from "../../providers/AppProviders";
import {
    ChatRegular,
    PeopleRegular,
    MoneySettingsRegular,
    ChevronDoubleLeftFilled,
    ChevronDoubleRightFilled,
    CheckboxPersonRegular
} from "@fluentui/react-icons";

interface SideMenuProps {
    isCollapsed: boolean;
    setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SideMenu: React.FC<SideMenuProps> = ({ isCollapsed, setIsCollapsed }) => {
    const [activeOption, setActiveOption] = useState<string>("Chat");
    const { user, organization } = useContext(AppContext);

    const handleSubscriptionRedirect = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();

        setActiveOption("Subscription");

        if (organization.subscriptionId) {
            window.location.href = "https://dashboard.stripe.com/dashboard";
        } else {
            window.location.href = "#/payment";
        }
    };

    return (
        <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ""}`}>
            <Link to="/" aria-label="Go to Home Page">
                <div className={styles.logo} onClick={() => setActiveOption("Chat")}>
                    <img src={isCollapsed ? isotipo : salesLogo} alt="Sales Factory logo" />
                </div>
            </Link>
            <nav>
                <ul>
                    <li>
                        <a href="#/" className={`${styles.link} ${activeOption === "Chat" ? styles.active : ""}`} onClick={() => setActiveOption("Chat")}>
                            <ChatRegular className={styles.icon} />
                            {!isCollapsed && "Chat"}
                        </a>
                    </li>
                    <li>
                        <a
                            href="#/admin"
                            className={`${styles.link} ${activeOption === "Roles" ? styles.active : ""}`}
                            onClick={() => setActiveOption("Roles")}
                        >
                            <PeopleRegular className={styles.icon} />
                            {!isCollapsed && "Roles and access"}
                        </a>
                    </li>
                    {user.role === "admin" && (
                        <li>
                            <a
                                href="#"
                                className={`${styles.link} ${activeOption === "Subscription" ? styles.active : ""}`}
                                onClick={handleSubscriptionRedirect}
                            >
                                <MoneySettingsRegular className={styles.icon} />
                                {!isCollapsed && "Subscription"}
                            </a>
                        </li>
                    )}
                    {user.role === "admin" && (
                        <li>
                            <a
                                href="#/invitations"
                                className={`${styles.link} ${activeOption === "Invitations" ? styles.active : ""}`}
                                onClick={() => setActiveOption("Invitations")}
                            >
                                <CheckboxPersonRegular className={styles.icon} />
                                {!isCollapsed && "Invitations"}
                            </a>
                        </li>
                    )}
                </ul>
            </nav>
            <div className={styles.collapseButton} onClick={() => setIsCollapsed(!isCollapsed)}>
                {isCollapsed ? <ChevronDoubleRightFilled /> : <ChevronDoubleLeftFilled />}{" "}
            </div>
        </aside>
    );
};
