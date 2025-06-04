import React, { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import styles from "./ProfileModal.module.css";
import { useAppContext } from "../../providers/AppProviders";

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAppContext();
    const [profileData, setProfileData] = useState({
        email: user?.email || "",
        username: user?.name || "",
        newPassword: "",
        confirmPassword: ""
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState("");

    const calculatePasswordStrength = (password: string): string => {
        if (password.length < 6) return "Weak";

        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        const strengthPoints = [hasUppercase, hasLowercase, hasNumbers, hasSpecialChar].filter(Boolean).length;

        if (password.length >= 8 && strengthPoints >= 3) return "Strong";
        if (password.length >= 6 && strengthPoints >= 2) return "Medium";
        return "Weak";
    };

    const handlePasswordChange = (password: string): void => {
        setProfileData(prev => ({ ...prev, newPassword: password }));
        setPasswordStrength(calculatePasswordStrength(password));
    };

    const handleSave = (): void => {
        // Aquí puedes agregar la lógica para guardar los cambios
        console.log("Saving profile data:", profileData);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <h2 className={styles.title}>User Profile</h2>
                        <button onClick={onClose} className={styles.closeButton}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Modal Content */}
                <div className={styles.content}>
                    {/* Email Address */}
                    <div className={styles.field}>
                        <label className={styles.label}>Email Address</label>
                        <input type="email" value={profileData.email} disabled className={`${styles.input} ${styles.inputDisabled}`} />
                        <p className={styles.helpText}>Email address cannot be changed</p>
                    </div>

                    {/* Username */}
                    <div className={styles.field}>
                        <label className={styles.label}>Username</label>
                        <input
                            type="text"
                            value={profileData.username}
                            onChange={e => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                            className={styles.input}
                        />
                        <p className={styles.helpText}>This name will be displayed to other users</p>
                    </div>

                    {/* Change Password Section */}
                    <div className={styles.passwordSection}>
                        <h3 className={styles.sectionTitle}>Change password</h3>

                        <div className={styles.passwordFields}>
                            {/* New Password */}
                            <div className={styles.field}>
                                <label className={styles.label}>New Password</label>
                                <div className={styles.inputContainer}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={profileData.newPassword}
                                        onChange={e => handlePasswordChange(e.target.value)}
                                        placeholder="Enter new password"
                                        className={styles.input}
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.eyeButton}>
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>

                                {/* Password Strength Indicator */}
                                {profileData.newPassword && (
                                    <div className={styles.strengthIndicator}>
                                        <div className={styles.strengthBar}>
                                            <div className={styles.strengthBarBackground}>
                                                <div
                                                    className={`${styles.strengthBarFill} ${
                                                        passwordStrength === "Weak"
                                                            ? styles.strengthWeak
                                                            : passwordStrength === "Medium"
                                                            ? styles.strengthMedium
                                                            : passwordStrength === "Strong"
                                                            ? styles.strengthStrong
                                                            : ""
                                                    }`}
                                                />
                                            </div>
                                            <span
                                                className={`${styles.strengthText} ${
                                                    passwordStrength === "Weak"
                                                        ? styles.strengthWeakText
                                                        : passwordStrength === "Medium"
                                                        ? styles.strengthMediumText
                                                        : passwordStrength === "Strong"
                                                        ? styles.strengthStrongText
                                                        : ""
                                                }`}
                                            >
                                                {passwordStrength}
                                            </span>
                                        </div>
                                        <p className={styles.passwordHint}>Use at least 8 characters with uppercase letters, lowercase letters, and numbers</p>
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div className={styles.field}>
                                <label className={styles.label}>Confirm Password</label>
                                <div className={styles.inputContainer}>
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={profileData.confirmPassword}
                                        onChange={e => setProfileData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        placeholder="Confirm new password"
                                        className={styles.input}
                                    />
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={styles.eyeButton}>
                                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {profileData.confirmPassword && profileData.newPassword !== profileData.confirmPassword && (
                                    <p className={styles.errorText}>Passwords do not match</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className={styles.footer}>
                    <button onClick={onClose} className={styles.cancelButton}>
                        Cancel
                    </button>
                    <button onClick={handleSave} className={styles.saveButton}>
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserProfileModal;
