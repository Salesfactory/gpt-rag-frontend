// Profilecopy.tsx
import React, { useState } from "react";
import styles from "./Profilecopy.module.css";
import { User, Building, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import UserProfileModal from "../ProfileModal/ProfileModal";
import OrganizationModal from "../OrganizationModal/OrganizationModal";

type Props = {
    show: boolean;
};

export const ProfilePanel = ({ show }: Props) => {
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showOrgModal, setShowOrgModal] = useState(false);

    const handleProfileClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        setShowProfileModal(true);
    };

    const handleOrgClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        setShowOrgModal(true);
    };

    return (
        <>
            <div className={`${styles.profileContainer} ${show ? styles.show : styles.hide}`}>
                <button onClick={handleProfileClick} className={styles.menuButton} role="button" aria-label="User profile Button">
                        <User size={18} className={styles.icon} />
                        <span className={styles.textMenu}>My Profile</span>
                </button>
                <button onClick={handleOrgClick} className={styles.menuButton} aria-label="Organization Button" role="button">

                        <Building size={18} className={styles.icon} />
                        <span className={styles.textMenu}>My Organization</span>
                </button>
                <div className={styles.logoutSeparator}></div>
                <Link to={"/logout"} className={styles.logoutButton}>
                    <LogOut size={18} className={styles.icon2} />
                    <span className={styles.textMenu2}>Logout</span>
                </Link>
            </div>

            <UserProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
            <OrganizationModal isOpen={showOrgModal} onClose={() => setShowOrgModal(false)} />
        </>
    );
};
