import React, { useState, useEffect, useContext } from "react";
import { Dropdown, TextField, Button, Spinner, DefaultButton } from "@fluentui/react";
import styles from "./FeedbackRating.module.css";
import { AppContext } from "../../providers/AppProviders";
import { AddFilled, SendRegular, ThumbLikeFilled, ThumbDislikeFilled } from "@fluentui/react-icons";
import { ThumbLikeRegular, ThumbDislikeRegular } from "@fluentui/react-icons";
import { postFeedbackRating } from "../../api/api";
import { MsalProvider, useMsal } from "@azure/msal-react";

const categoryOptions = [
    { key: "1", text: "Incorrect data" },
    { key: "2", text: "Lack of sources" },
    { key: "3", text: "Lack of context" },
    { key: "4", text: "Redundant information" },
    { key: "5", text: "Other" }
];

export const FeedbackRating = () => {
    const { showFeedbackRatingPanel, setShowFeedbackRatingPanel, dataConversation, chatId} = useContext(AppContext);
    const {instance, accounts} = useMsal();
    const [category, setCategory] = useState("");
    const [feedback, setFeedback] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [selectedThumb, setSelectedThumb] = useState<string | null>("");
    const [errorMessage, setErrorMessage] = useState<string | null>("");
    const activeAccount = instance.getActiveAccount();


    const handleCategoryChange = (event: any, selectedOption: any) => {
        setErrorMessage("");
        setCategory(selectedOption.text);
    };

    const handleFeedbackChange = (event: any) => {
        setErrorMessage("");
        setFeedback(event.target.value);
    };

    const handleClosePannel = () => {
        setShowFeedbackRatingPanel(!showFeedbackRatingPanel);
    };

    const handleSubmitFeedback = async () => {
        setIsLoading(true);

        // if no category is selected
        if (category === "") {
            setErrorMessage("Please select a category");
            setIsLoading(false);
            return;
        }

        // if no feedback message is provided
        if (feedback === "") {
            setErrorMessage("Please provide a message");
            setIsLoading(false);
            return;
        }

        // if not set chat id or dataConversation is empty
        if (chatId === "" || dataConversation?.length === 0) {
            setErrorMessage("Please select a chat or send a message first");
            setIsLoading(false);
            return;
        }

        await postFeedbackRating({
            user: {
                id: activeAccount?.localAccountId,
                name: activeAccount?.name
            },
            conversation_id: chatId,
            feedback_message: feedback,
            question: dataConversation[dataConversation.length - 1].user,
            answer: dataConversation[dataConversation.length - 1].bot,
            rating: selectedThumb === "like" ? true : selectedThumb === "dislike" ? false : null,
            category: category
        })
            .then(() => {
                setIsLoading(false);
                // setCategory("");
                setFeedback("");
                setSelectedThumb("");
                setErrorMessage("");
            })
            .catch(error => {
                setErrorMessage("Error sending feedback");
                setIsLoading(false);
            });
    };

    const handleSelectedThumb = (thumb: string) => {
        if (selectedThumb === thumb) {
            setSelectedThumb("");
            return;
        }
        setSelectedThumb(thumb);
    };

    return (
        <section className={styles.container} data-is-scrollable aria-label="feedback panel">
            <div className={styles.cardFeedback}>
                <div className={styles.header}>
                    <div className={styles.title}>Feedback</div>
                    <div className={styles.buttons}>
                        <div className={styles.closeButtonContainer}>
                            <button className={styles.closeButton} aria-label="hide button" onClick={handleClosePannel}>
                                <AddFilled />
                            </button>
                        </div>
                    </div>
                </div>
                <div className={styles.content}>
                    <div className={styles.listContainer}>
                        {isLoading && (
                            <div className={styles.loaderContainer}>
                                <Spinner size={3} />
                            </div>
                        )}

                        <Dropdown placeholder="Select Category" options={categoryOptions} onChange={handleCategoryChange} defaultValue={category} />
                        <TextField label="Message" multiline onChange={handleFeedbackChange} value={feedback} className={styles.message} />
                        <div className={styles.rating}>
                            <button
                                className={styles.thumbButton}
                                aria-label="like"
                                aria-pressed={selectedThumb === "like"}
                                onClick={() => handleSelectedThumb("like")}
                            >
                                {selectedThumb === "like" ? <ThumbLikeFilled /> : <ThumbLikeRegular />}
                            </button>
                            <button
                                className={styles.thumbButton}
                                aria-label="dislike"
                                aria-pressed={selectedThumb === "dislike"}
                                onClick={() => handleSelectedThumb("dislike")}
                            >
                                {selectedThumb === "dislike" ? <ThumbDislikeFilled /> : <ThumbDislikeRegular />}
                            </button>
                        </div>
                        <DefaultButton className={styles.saveButton} onClick={handleSubmitFeedback}>
                            &#8202;&#8202;Send
                            <SendRegular className={styles.sendIcon} />
                        </DefaultButton>
                    </div>
                    {errorMessage !== null && <p className={styles.error}>{errorMessage}</p>}
                </div>
            </div>
        </section>
    );
};

export default FeedbackRating;
