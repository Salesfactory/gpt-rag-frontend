import React, { useContext } from "react";
import { Label } from "@fluentui/react";
import { Globe32Regular } from "@fluentui/react-icons";
import { AppContext } from "../../providers/AppProviders";

import styles from "./Organization.module.css";

const Organization = () => {
    const { organization } = useContext(AppContext);
    const { user } = useContext(AppContext);

    return (
        <div className={styles.page_container}>
            {user.role !== "admin" && <h1>Access denied</h1>}
            {user.role === "admin" && (
                <>
                    <div id="options-row" className={styles.row}>
                        <h1 className={styles.title}>Organization</h1>
                    </div>
                    <div className={styles.center}>
                        <div className={styles.card}>
                            <Globe32Regular />
                            <div className={styles.infoContainer}>
                                <div className={styles.infoItem}>
                                    <Label>Organization ID</Label>
                                    <span className={styles.info}>{organization.id} </span>
                                </div>
                            </div>
                            <div className={styles.infoContainer}>
                                <div className={styles.infoItem}>
                                    <Label>Organization Name</Label>
                                    <span className={styles.info}>{organization.name} </span>
                                </div>
                                <div className={styles.infoItem}>
                                    <Label>Organization Owner</Label>
                                    <span className={styles.info}>{organization.owner} </span>
                                </div>
                            </div>
                            <div className={styles.infoContainer}>
                                <div className={styles.infoItem}>
                                    <Label>Subscription ID</Label>
                                    <span className={styles.info}>{organization.subscriptionId} </span>
                                </div>
                            </div>
                            <div className={styles.infoContainer}>
                                <div className={styles.infoItem}>
                                    <Label>Subscription Status</Label>
                                    <span className={styles.info}>{organization.subscriptionStatus} </span>
                                </div>
                                <div className={styles.infoItem}>
                                    <Label>Subscription Expiration</Label>
                                    <span className={styles.info}>{organization.subscriptionExpirationDate} </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Organization;
