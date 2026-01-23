import React, { useEffect, useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import styles from "./ProfileModal.module.css";
import { useAppContext } from "../../providers/AppProviders";
import { toast } from "react-toastify";
import { getUserById, updateUserData } from "../../api";
import { Spinner, SpinnerSize } from "@fluentui/react";

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
    const { user, userName, setUserName } = useAppContext();
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (): Promise<void> => {
        setIsSaving(true);

        try {
            if (!user?.id || !user?.role || !user?.email) {
                toast("Invalid user data", { type: "error" });
                return;
            }

            await updateUserData({
                userId: user.id,
                patchData: {
                    name: userName,
                    email: user.email,
                    role: user.role
                }
            });
            toast("User data updated successfully. The window will restart in 2 seconds.", { type: "success" });
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            console.error("Error updating user data", error);
            toast("Failed to update user data", { type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        try {
            const res = await fetch("/api/get-password-reset-url");
            const data = await res.json();
            if (data.resetUrl) {
                window.location.href = data.resetUrl;
            } else {
                toast("Reset URL not received", { type: "error" });
            }
        } catch (err) {
            toast("Error getting URL", { type: "error" });
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <h2 className={styles.title}>User Profile</h2>
                        <button onClick={onClose} className={styles.closeButton} disabled={isSaving} aria-label="close">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Modal Content */}
                <div className={styles.content}>
                    {/* Email Address */}
                    <div className={styles.field}>
                        <label className={styles.label}>Email Address</label>
                        <input type="email" value={user?.email ?? ""} disabled className={`${styles.input} ${styles.inputDisabled}`} />
                        <p className={styles.helpText}>Email address cannot be changed</p>
                    </div>

                    {/* Username */}
                    <div className={styles.field}>
                        <label className={styles.label}>Username</label>
                        <input
                            type="text"
                            aria-label="Username Input"
                            value={userName}
                            onChange={e => setUserName(e.target.value)}
                            className={styles.input}
                            disabled={isSaving}
                        />
                        <p className={styles.helpText}>This name will be displayed to other users</p>
                    </div>

                    {/* Reset Password Button */}
                    <div className={styles.field2}>
                        <button className={styles.saveButton2} onClick={handleChangePassword} disabled={isSaving} aria-label="Change Password">
                            Change Password
                        </button>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className={styles.footer}>
                    <button onClick={onClose} className={styles.cancelButton} disabled={isSaving} aria-label="Cancel">
                        Cancel
                    </button>

                    {isSaving ? (
                        <button className={styles.saveButton} disabled aria-label="Loading...">
                            <Spinner size={SpinnerSize.small} />
                        </button>
                    ) : (
                        <button onClick={handleSave} className={styles.saveButton} disabled={!userName.trim()} aria-label="Save Changes">
                            Save Changes
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserProfileModal;
