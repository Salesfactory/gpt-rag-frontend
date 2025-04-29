import React, { useContext, useEffect, useRef, useState } from "react";
import { Label } from "@fluentui/react";
import { Globe32Regular } from "@fluentui/react-icons";
import { useAppContext } from "../../providers/AppProviders";

import styles from "./Organization.module.css";

const Organization = () => {
    const { organization } = useAppContext();
    const expirationDate = new Date((organization?.subscriptionExpirationDate || 0) * 1000).toLocaleDateString();
    const [brandInformation, setBrandInformation] = useState("");
    const [segmentSynonyms, setSegmentSynonyms] = useState("");
    const [industryInformation, setIndustryInformation] = useState("");

    const brandRef = useRef<HTMLTextAreaElement>(null);
    const industryRef = useRef<HTMLTextAreaElement>(null);
    const synonymRef = useRef<HTMLTextAreaElement>(null);

    if (!organization) {
        return (
            <div>
                <p>No Organization</p>
            </div>
        );
    }

    const autoResize = (ref: React.RefObject<HTMLTextAreaElement>) => {
        if (ref.current) {
            ref.current.style.height = "auto";
            ref.current.style.height = `${ref.current.scrollHeight}px`;
        }
    };

    useEffect(() => {
        autoResize(brandRef);
    }, [brandInformation]);

    useEffect(() => {
        autoResize(industryRef);
    }, [industryInformation]);

    useEffect(() => {
        autoResize(synonymRef);
    }, [segmentSynonyms]);

    return (
        <div className={styles.page_container}>
            <div id="options-row" className={styles.row}>
                <h1 className={styles.title}>Organization</h1>
            </div>
            <div className={styles.center}>
                <div className={styles.card}>
                    <Globe32Regular />
                    <div className={styles.infoContainer}>
                        <div className={styles.infoItem}>
                            <Label>Organization ID</Label>
                            <span className={styles.info}>{organization?.id} </span>
                        </div>
                    </div>
                    <div className={styles.infoContainer}>
                        <div className={styles.infoItem}>
                            <Label>Organization Name</Label>
                            <span className={styles.info}>{organization?.name} </span>
                        </div>
                        <div className={styles.infoItem}>
                            <Label>Organization Owner</Label>
                            <span className={styles.info}>{organization?.owner} </span>
                        </div>
                    </div>
                    <div className={styles.infoContainer}>
                        <div className={styles.infoItem}>
                            <Label>Subscription ID</Label>
                            <span className={styles.info}>{organization?.subscriptionId} </span>
                        </div>
                    </div>
                    <div className={styles.infoContainer}>
                        <div className={styles.infoItem}>
                            <Label>Subscription Status</Label>
                            <span className={styles.info}>{organization?.subscriptionStatus} </span>
                        </div>
                        <div className={styles.infoItem}>
                            <Label>Subscription Expiration</Label>
                            <span className={styles.info}>{expirationDate} </span>
                        </div>
                    </div>
                </div>
                <div className={styles.card}>
                <div className={styles.editableContainer}>
                    <div className={styles.infoItem}>
                        <Label>Brand Description</Label>
                        <textarea
                            ref={brandRef}
                            className={styles.textArea}
                            placeholder="Describe your brand's identity, target audience, and unique value proposition. What makes your brand stand out?"
                            value={brandInformation}
                            onChange={(e) => setBrandInformation(e.target.value)}
                        />
                    </div>
                    <div className={styles.infoItem}>
                        <Label>Business Description</Label>
                        <textarea
                            ref={industryRef}
                            className={styles.textArea}
                            placeholder="Describe your business's core services, industry, and target market."
                            value={industryInformation}
                            onChange={(e) => setIndustryInformation(e.target.value)}
                        />
                    </div>
                    <div className={styles.infoItem}>
                        <Label>Segment Synonyms</Label>
                        <textarea
                            ref={synonymRef}
                            className={styles.textArea}
                            placeholder="List synonyms or alternative names for your customer segments (e.g., 'Budget-Conscious Shoppers' -> 'Efficiency-Driven Decision Makers')."
                            value={segmentSynonyms}
                            onChange={(e) => setSegmentSynonyms(e.target.value)}
                        />
                    </div>
                    <button className={styles.saveButton} >
                        Save Changes
                    </button>
                </div>
                </div>
            </div>
        </div>
    );
};

export default Organization;
