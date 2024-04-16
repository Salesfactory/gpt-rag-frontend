import React, { useState } from "react";
import { Dropdown, TextField, Button, Spinner, DefaultButton } from "@fluentui/react";
import styles from "./FeedbackRating.module.css";
import { useAppContext } from "../../providers/AppProviders";
import { AddFilled, SaveFilled, ThumbLikeFilled, ThumbDislikeFilled } from "@fluentui/react-icons";
import { ThumbLikeRegular, ThumbDislikeRegular } from "@fluentui/react-icons";
import { postFeedbackRating } from "../../api/api";

const categoryOptions = [
    { key: "1", text: "Incorrect data" },
    { key: "2", text: "Lack of sources" },
    { key: "3", text: "Lack of context" },
    { key: "4", text: "Redundant information" },
    { key: "5", text: "Other" }
];

export const FeedbackRating = () => {
    const { showFeedbackRatingPanel, setShowFeedbackRatingPanel, dataConversation, chatId, userId } = useAppContext();

    const [category, setCategory] = useState("");
    const [feedback, setFeedback] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [selectedThumb, setSelectedThumb] = useState<string | null>("");
    const [errorMessage, setErrorMessage] = useState<string | null>("");

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
                id: userId,
                name: "anonymous" // set name in provider
            },
            conversation_id: chatId,
            feedback_message: feedback,
            question: dataConversation[0].user,
            answer: dataConversation[0].bot,
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
                    <TextField label="Message" multiline onChange={handleFeedbackChange} value={feedback} />
                    <div className={styles.rating}>
                        {selectedThumb === "like" ? (
                            <ThumbLikeFilled onClick={() => handleSelectedThumb("like")} />
                        ) : (
                            <ThumbLikeRegular onClick={() => handleSelectedThumb("like")} />
                        )}
                        {selectedThumb === "dislike" ? (
                            <ThumbDislikeFilled onClick={() => handleSelectedThumb("dislike")} />
                        ) : (
                            <ThumbDislikeRegular onClick={() => handleSelectedThumb("dislike")} />
                        )}
                    </div>
                    <DefaultButton className={styles.saveButton} onClick={handleSubmitFeedback}>
                        <SaveFilled />
                        &#8202;&#8202;Send
                    </DefaultButton>
                </div>
                {errorMessage !== null && <p className={styles.error}>{errorMessage}</p>}
            </div>
        </section>
    );
};

export default FeedbackRating;
