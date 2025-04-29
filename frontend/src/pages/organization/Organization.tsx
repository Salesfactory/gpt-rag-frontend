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
                            placeholder="To challenger brands hungry to punch above their weight and prove they belong
Brand Sales Factory is the retail growth engine that turns underdogs into disruptors
That makes you believe you can outsmart bigger competitors and win at shelf, not just survive
That's because Sales Factory aligns strategy and execution through shared goals and data-driven precision — so every move is calculated for maximum impact
Engagement when you're facing your make-or-break moment — a new product launch, a seasonal promotion, or the fight for your place on the planogram"
                            value={brandInformation}
                            onChange={(e) => setBrandInformation(e.target.value)}
                        />
                    </div>
                    <div className={styles.infoItem}>
                        <Label>Business Description</Label>
                        <textarea
                            ref={industryRef}
                            className={styles.textArea}
                            placeholder="Sales Factory provides services that help businesses promote their products and brands across various channels. We develop strategies, manage campaigns, create content, and leverage data to influence consumer behavior and drive sales.
Core Services Include:
Brand strategy & positioning
Advertising (TV, radio, print, digital)
Digital marketing (SEO, PPC, email, social media)
Content creation and storytelling
Media buying and planning
Market research and analytics
Influencer and experiential marketing
Retail and shopper marketing"
                            value={industryInformation}
                            onChange={(e) => setIndustryInformation(e.target.value)}
                        />
                    </div>
                    <div className={styles.infoItem}>
                        <Label>Segment Synonyms</Label>
                        <textarea
                            ref={synonymRef}
                            className={styles.textArea}
                            placeholder="When talking about segments, use these more strategic, emotionally resonant synonyms in your answers:
Young Professionals > Brand Builders-in-Motion
Budget-Conscious Shoppers > Efficiency-Driven Decision Makers
Luxury Seekers > Premium-Positioning Pursuers
Tech-Savvy Millennials > Digital-Native Disruptors
New Parents  Growth Guardians"
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
