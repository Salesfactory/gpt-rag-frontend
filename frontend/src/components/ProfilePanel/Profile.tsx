import { IconListCheck, IconMail, IconUser } from "@tabler/icons-react";
import React from "react";
import styles from "./Profile.module.css"
import { Link } from "react-router-dom";

export const ProfilePanel = () => {
    
    return (
        
        <div className={styles.messageBody}>
            <Link to={""} className="d-flex align-items-center gap-2 dropdown-item">
                <IconUser className="fs-6" />
                <p className="mb-0 fs-5">My Profile</p>
            </Link>
            <Link to={""} className="d-flex align-items-center gap-2 dropdown-item">
                <IconMail className="fs-6" />
                <p className="mb-0 fs-5">My Account</p>
            </Link>
            <Link to={""} className="d-flex align-items-center gap-2 dropdown-item">
                <IconListCheck className="fs-6" />
                <p className="mb-0 fs-5">My Task</p>
            </Link>
            <Link to={"/logout"} className="btn btn-outline-primary mx-3 mt-2 d-block">
                Logout
            </Link>
        </div>

    );
};