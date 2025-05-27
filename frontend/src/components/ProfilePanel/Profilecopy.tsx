import React from "react";
import styles from "./Profilecopy.module.css";
import { User, Mail, List } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
    show: boolean;
};

export const ProfilePanel = ({ show }: Props) => {
    return (
        <div className={`${styles.profileContainer} ${show ? styles.show : styles.hide}`}>
            <Link to={""} className={styles.menuItem}>
                <div className={styles.menuItemContent}>
                    <User size={18} className={styles.icon} />
                    <span className={styles.textMenu}>My Profile</span>
                </div>
            </Link>
            <Link to={""} className={styles.menuItem}>
                <div className={styles.menuItemContent}>
                    <Mail size={18} className={styles.icon} />
                    <span className={styles.textMenu}>My Account</span>
                </div>
            </Link>
            <Link to={""} className={styles.menuItem}>
                <div className={styles.menuItemContent}>
                    <List size={18} className={styles.icon} />
                    <span className={styles.textMenu}>My Task</span>
                </div>
            </Link>
            <div className={styles.logoutSeparator}></div>
            <Link to={"/logout"} className={styles.logoutButton}>
                Logout
            </Link>
        </div>
    );
};
