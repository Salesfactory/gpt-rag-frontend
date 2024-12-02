import React from "react";
import styles from "./UserManagement.module.css"

const UserManagement: React.FC = () => {
    return (
        <div className={styles.page_container}>
            <h1>User Management</h1>
            <p>Welcome to the User Management page!</p>
        </div>
    );
};

export default UserManagement;
