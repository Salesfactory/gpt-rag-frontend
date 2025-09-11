import React, { useEffect, useState, useContext } from "react";
import { PrimaryButton, Spinner, Dialog, DialogContent, Label, Dropdown, DefaultButton, MessageBar, ResponsiveMode, SpinnerSize } from "@fluentui/react";
import { toast } from "react-toastify";
import { TextField, ITextFieldStyles } from "@fluentui/react/lib/TextField";
import { CirclePlus, Search, SquarePen, Trash2, Filter, X } from "lucide-react";

import { useAppContext } from "../../providers/AppProviders";
import DOMPurify from "dompurify";

import { getUsers, inviteUser, createInvitation, deleteUser, updateUserData, deleteInvitation, resetUserPassword } from "../../api";

import styles from "./Admincopy.module.css";
import { Toast } from "react-toastify/dist/components";

const textFieldStyles: Partial<ITextFieldStyles> = { root: { maxWidth: "900px" } };
export const CreateUserForm = ({ isOpen, setIsOpen, users }: { isOpen: boolean; setIsOpen: React.Dispatch<React.SetStateAction<boolean>>; users: never[] }) => {
    const { user, organization } = useAppContext();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("user");
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const isValidated = (sanitizedUsername: string, sanitizedEmail: string) => {
        if (!sanitizedUsername || !sanitizedEmail) {
            setErrorMessage("Please fill in all fields");
            return false;
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            setErrorMessage("Please provide a valid email address");
            return false;
        }
        return true;
    };

    const alreadyExists = (sanitizedEmail: string) => {
        return users.some((existingUser: any) => existingUser.data.email === sanitizedEmail);
    };

    const handleSubmit = async () => {
        const sanitizedUsername = DOMPurify.sanitize(username);
        const sanitizedEmail = DOMPurify.sanitize(email).replace(/\s+/g, "").toLowerCase();

        if (!isValidated(sanitizedUsername, sanitizedEmail)) return;
        if (alreadyExists(sanitizedEmail)) {
            setErrorMessage("User with this email already exists");
            return;
        }
        if (!user) {
            setErrorMessage("You must be logged in to invite a user.");
            return;
        }
        setLoading(true);

        try {
            const organizationId = user.organizationId;
            const organizationName = organization?.name;

            const invitationResponse = await createInvitation({
                organizationId,
                nickname: sanitizedUsername,
                invitedUserEmail: sanitizedEmail,
                userId: user.id,
                role
            });

            if (invitationResponse?.error) {
                setErrorMessage(invitationResponse.error);
            } else {
                setErrorMessage("");
            }

            const inviteResponse = await inviteUser({
                username: sanitizedUsername,
                email: sanitizedEmail,
                role,
                organizationId,
                organizationName
            });

            if (inviteResponse.error) {
                setErrorMessage(inviteResponse.error);
                setLoading(false);
                return;
            } else {
                setSuccess(true);
            }
        } catch (error) {
            setErrorMessage("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const onUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value || "");
    const onEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value || "");
    const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault();
            handleSubmit();
        }
    };

    const roleOptions = [
        { key: "user", text: "user" },
        { key: "admin", text: "admin" }
    ];

    const handleRoleChange = (event: any, selectedOption: any) => {
        setRole(selectedOption.text);
    };

    const onDismiss = () => {
        setEmail("");
        setUsername("");
        setRole("user");
        setErrorMessage("");
        setLoading(false);
        setIsOpen(false);
        setSuccess(false);
    };

    const onConfirm = () => {
        handleSubmit();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlayE} onClick={onDismiss}>
            <div className={styles.dialogE} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.headerE}>
                    <h2 className={styles.titleE}>Create a new user</h2>
                    <button onClick={onDismiss} className={styles.closeButtonE} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>
                {/* Content */}
                <div className={styles.contentE}>
                    {loading ? (
                        <Spinner
                            styles={{
                                root: {
                                    marginTop: "50px"
                                }
                            }}
                        />
                    ) : !success ? (
                        <form
                            onSubmit={e => {
                                e.preventDefault();
                                handleSubmit();
                            }}
                        >
                            <div className={styles.fieldGroupE}>
                                <label className={styles.labelE}>Username</label>
                                <input
                                    type="text"
                                    className={styles.inputE}
                                    placeholder="Username"
                                    value={username}
                                    onChange={onUserNameChange}
                                    onKeyDown={onEnterPress}
                                />
                            </div>
                            <div className={styles.fieldGroupE}>
                                <label className={styles.labelE}>Email</label>
                                <input
                                    type="email"
                                    className={styles.inputE}
                                    placeholder="Email"
                                    value={email}
                                    onChange={onEmailChange}
                                    onKeyDown={onEnterPress}
                                />
                            </div>
                            <div className={styles.fieldGroupE}>
                                <label className={styles.labelE}>User Role</label>
                                <select className={styles.dropdownE} value={role} onChange={e => setRole(e.target.value)}>
                                    {roleOptions.map(option => (
                                        <option key={option.key} value={option.key}>
                                            {option.text}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {errorMessage && <div className={styles.errorMessageE}>{errorMessage}</div>}
                            <div className={styles.buttonContainerE}>
                                <button type="button" onClick={onDismiss} className={styles.cancelButtonE}>
                                    Cancel
                                </button>
                                <button type="submit" className={styles.saveButtonE} disabled={loading}>
                                    Send Invitation
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div>
                            <h3 style={{ fontSize: 16 }}>Invitation Sent</h3>
                            <p style={{ fontSize: 16 }}>
                                An invitation has been sent to <strong>{email}</strong>. They will receive an email with a link to create an account.
                            </p>
                            <div className={styles.buttonContainerE}>
                                <button type="button" className={styles.saveButtonE} onClick={onDismiss}>
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const DeleteUserDialog = ({
    isOpen,
    onDismiss,
    onConfirm,
    isDeletingUser,
    userName
}: {
    isOpen: boolean;
    onDismiss: any;
    onConfirm: any;
    isDeletingUser: boolean;
    userName?: string;
}) => {
    if (!isOpen) return null;

    return (
        <div className={styles.overlayD} onClick={onDismiss}>
            <div className={styles.dialogD} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.headerD}>
                    <h2 className={styles.titleD}>Delete User</h2>
                    <button onClick={onDismiss} className={styles.closeButtonD} aria-label="Close">
                        <X />
                    </button>
                </div>

                {/* Content */}
                <div className={styles.contentD}>
                    <p className={styles.messageD}>
                        Are you sure you want to remove <strong>{userName}</strong> from the team?
                    </p>

                    {/* Buttons */}
                    <div className={styles.buttonContainerD}>
                        <button onClick={onDismiss} className={styles.cancelButtonD} disabled={isDeletingUser}>
                            Cancel
                        </button>
                        <button onClick={onConfirm} className={styles.deleteButtonD} disabled={isDeletingUser}>
                            {isDeletingUser ? <Spinner size={SpinnerSize.small} /> : "Yes, Delete"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export const DeleteInvitationDialog = ({
    isOpen,
    onDismiss,
    onConfirm,
    selectedInvitation,
    isDeletingUser
}: {
    isOpen: boolean;
    onDismiss: () => void;
    onConfirm: (invitationId: string) => void;
    selectedInvitation?: { invitation_id: string; id: string };
    isDeletingUser: boolean;
}) => {
    if (!isOpen) return null;

    const handleConfirm = () => {
        if (selectedInvitation) {
            onConfirm(selectedInvitation.invitation_id);
        }
    };

    return (
        <div className={styles.overlayD} onClick={onDismiss}>
            <div className={styles.dialogD} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.headerD}>
                    <h2 className={styles.titleD}>Delete Invitation</h2>
                    <button onClick={onDismiss} className={styles.closeButtonD} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className={styles.contentD}>
                    <p className={styles.messageD}>Are you sure you want to delete this invitation? This action cannot be undone.</p>

                    {/* Buttons */}
                    <div className={styles.buttonContainerD}>
                        <button onClick={onDismiss} className={styles.cancelButtonD}>
                            Cancel
                        </button>
                        <button onClick={handleConfirm} className={styles.deleteButtonD} disabled={isDeletingUser}>
                            {isDeletingUser ? <Spinner size={SpinnerSize.small} /> : "Delete invitation"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const EditUserDialog = ({
    isOpen,
    onDismiss,
    onConfirm,
    selectedUser,
    inputUserName,
    categorySelection,
    roleOptions,
    errorMessage,
    handleInputName,
    handleTypeDropdownChange,
    isSavingUser,
    setInputUserName,
    setCategorySelection
}: {
    isOpen: boolean;
    onDismiss: () => void;
    onConfirm: (userId: string) => void;
    selectedUser?: {
        role: string;
        id: string;
        data: { name: string; email: string; role?: string };
    };
    inputUserName: string;
    inputEmailName: string;
    categorySelection: string;
    roleOptions: Array<{ key: string; text: string }>;
    errorMessage: string;
    handleInputName: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleTypeDropdownChange: (event: any, option: any) => void;
    isSavingUser?: boolean;
    setInputUserName: React.Dispatch<React.SetStateAction<string>>;
    setCategorySelection: React.Dispatch<React.SetStateAction<string>>;
}) => {
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    useEffect(() => {
        if (isOpen && selectedUser) {
            setInputUserName(selectedUser.data.name || "");
            setCategorySelection(selectedUser.role || "");
        }
    }, [isOpen, selectedUser, setInputUserName, setCategorySelection]);

    if (!isOpen || !selectedUser) return null;

    const handleCancel = () => {
        onDismiss();
    };

    const handleConfirm = () => {
        // Check if values are unchanged
        if (inputUserName === (selectedUser.data.name || "") && categorySelection === (selectedUser.role || "")) {
            toast("You must edit at least one field before saving changes.", { type: "warning" });
            return;
        }
        onConfirm(selectedUser.id);
    };

    function generateRandomPassword(length = 12) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        let password = "";
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    const handleResetPassword = async () => {
        if (!selectedUser?.id) return;
        setIsResettingPassword(true);
        try {
            const newPassword = generateRandomPassword();
            const res = await resetUserPassword({ userId: selectedUser.id, newPassword });
            if (res.error) {
                toast("Error resetting password: " + res.error, { type: "error" });
            } else {
                toast(`Password reset! The user will receive an email with their new password.`, { type: "success" });
            }
        } catch (e) {
            toast("Error resetting password", { type: "error" });
        } finally {
            setIsResettingPassword(false);
        }
    };

    return (
        <div className={styles.overlayE} onClick={handleCancel}>
            <div className={styles.dialogE} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.headerE}>
                    <h2 className={styles.titleE}>Edit User</h2>
                    <button onClick={handleCancel} className={styles.closeButtonE} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className={styles.contentE}>
                    <div>
                        {/* Email Address */}
                        <div className={styles.fieldGroupE}>
                            <label className={styles.labelE}>Email Address</label>
                            <input type="email" className={styles.inputE} value={selectedUser.data.email} disabled readOnly />
                            <span className={styles.helpTextE}>Email address cannot be changed</span>
                        </div>

                        {/* Username */}
                        <div className={styles.fieldGroupE}>
                            <label className={styles.labelE}>Username</label>
                            <input type="text" className={styles.inputE} onChange={handleInputName} value={inputUserName} placeholder="Username" />
                            <span className={styles.helpTextE}>This name will be displayed to other users</span>
                        </div>

                        {/* Role Dropdown */}
                        <div className={styles.fieldGroupE}>
                            <label className={styles.labelE}>Role</label>
                            <select
                                className={styles.dropdownE}
                                value={categorySelection}
                                onChange={e => {
                                    const selectedKey = e.target.value;
                                    const selectedOption = roleOptions.find(opt => opt.key === selectedKey);
                                    if (selectedOption) {
                                        handleTypeDropdownChange(null, selectedOption);
                                    }
                                }}
                            >
                                <option value="">Select a Role</option>
                                {roleOptions.map(option => (
                                    <option key={option.key} value={option.key}>
                                        {option.text}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Change Password Button */}
                        <div className={styles.passwordSectionE}>
                            <button type="button" className={styles.changePasswordButtonE} onClick={handleResetPassword} disabled={isResettingPassword}>
                                {isResettingPassword ? <Spinner size={SpinnerSize.small} /> : "Reset Password"}
                            </button>
                        </div>

                        {/* Buttons */}
                        <div className={styles.buttonContainerE}>
                            <button type="button" onClick={handleCancel} className={styles.cancelButtonE}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                className={styles.saveButtonE}
                                disabled={
                                    isSavingUser ||
                                    (inputUserName === (selectedUser.data.name || "") && categorySelection === (selectedUser.role || "")) ||
                                    inputUserName.trim() === ""
                                }
                            >
                                {isSavingUser ? <Spinner size={SpinnerSize.small} /> : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const roleFilterOptions = [
    { label: "All Roles", value: "all" },
    { label: "User", value: "user" },
    { label: "Admin", value: "admin" },
    { label: "Platform Admin", value: "platformAdmin" }
];

const Admin = () => {
    const { user, organization } = useAppContext();
    const [search, setSearch] = useState("");
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [roleFilter, setRoleFilter] = useState("all");
    const [selectedUser, setSelectedUser] = useState({
        id: "",
        data: {
            name: "",
            email: "",
            role: ""
        },
        role: ""
    });
    const [selectedInvitation, setSelectedInvitation] = useState({
        id: "",
        nickname: "",
        role: "",
        invitation_id: ""
    });

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isOpen, setIsOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeletingUser, setIsDeletingUser] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [inputUserName, setInputUserName] = useState("");
    const [inputEmailName, setInputEmailName] = useState("");
    const roleOptions = [
        { key: "user", text: "user" },
        { key: "admin", text: "admin" }
    ];
    const [categorySelection, setCategorySelection] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [dataLoad, setDataLoad] = useState(false);
    const [showDeleteInvitationModal, setShowDeleteInvitationModal] = useState(false);
    const [isEditSuccess, setIsEditSuccess] = useState(false);
    const [isSavingUser, setIsSavingUser] = useState(false);
    const roleStyles: { [key in "admin" | "user" | "platformAdmin"]: string } = {
        admin: styles.roleAdmin,
        user: styles.roleUser,
        platformAdmin: styles.rolePlatformAdmin
    };

    if (!user) {
        return <div>Please log in to view the user list.</div>;
    }

    useEffect(() => {
        const getUserList = async () => {
            if (!user) {
                // User is not logged in
                setUsers([]);
                setFilteredUsers([]);
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                let usersList = await getUsers({
                    user: {
                        id: user.id,
                        name: user.name,
                        organizationId: user.organizationId
                    }
                });

                if (!Array.isArray(usersList)) {
                    usersList = [];
                }
                setUsers(usersList);
                setFilteredUsers(usersList);
            } catch (error) {
                console.error("Error fetching user list:", error);
                setUsers([]);
                setFilteredUsers([]);
            } finally {
                setLoading(false);
            }
        };

        getUserList();
    }, [dataLoad]);

    useEffect(() => {
        let filtered = users;
        if (search) {
            filtered = filtered.filter((user: any) => {
                if (user.user_new) {
                    return (
                        (user.nickname && user.nickname.toLowerCase().includes(search.toLowerCase())) ||
                        (user.data?.email && user.data.email.toLowerCase().includes(search.toLowerCase()))
                    );
                }
                return (
                    (user.data?.name && user.data.name.toLowerCase().includes(search.toLowerCase())) ||
                    (user.data?.email && user.data.email.toLowerCase().includes(search.toLowerCase()))
                );
            });
        }
        if (roleFilter !== "all") {
            filtered = filtered.filter((user: any) => user.role === roleFilter);
        }
        setFilteredUsers(filtered);
    }, [search, roleFilter, users]);

    const handleDeleteClick = (user: any) => {
        setSelectedUser(user);
        setIsDeleting(true);
    };

    const deleteUserFromOrganization = (id: string) => {
        setIsDeletingUser(true);
        deleteUser({ user, userId: id, organizationId: organization?.id }).then(res => {
            if (res.error) {
                console.log("error", res.error);
                toast("There was an error deleting the user", { type: "error" });
                setIsDeleting(false);
            } else {
                const updatedUsers = users.filter((user: any) => user.id !== id);
                setUsers(updatedUsers);
                setFilteredUsers(updatedUsers);
                setIsDeleting(false);
                toast("User deleted successfully", { type: "success" });
            }
            setIsDeletingUser(false);
        });
    };

    const deleteInvitationFromOrganization = (id: string) => {
        setIsDeletingUser(true);
        deleteInvitation({ user, invitationId: id }).then(res => {
            if (res.error) {
                console.log("error", res.error);
                toast("There was an error deleting the invitation", { type: "error" });
                setIsDeleting(false);
            } else {
                const updatedUsers = users.filter((user: any) => user.invitation_id !== id);
                setUsers(updatedUsers);
                setFilteredUsers(updatedUsers);
                setIsDeleting(false);
                setShowDeleteInvitationModal(false);
                toast("Invitation deleted successfully", { type: "success" });
            }
            setIsDeletingUser(false);
        });
    };

    const handleEditClick = (user: any) => {
        setSelectedUser(user);
        setIsEditing(true);
    };

    const handleInputName = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputUserName(event.target.value);
    };

    const handleInputEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputEmailName(event.target.value);
    };

    const handleTypeDropdownChange = (event: any, selectedOption: any) => {
        setCategorySelection(selectedOption.text);
    };

    const editUser = async (userID: string) => {
        if (inputUserName == "") {
            toast("Please type the Username", { type: "error" });
            return;
        }

        let timer: NodeJS.Timeout;
        setIsSavingUser(true);
        try {
            await updateUserData({
                userId: userID,
                patchData: {
                    name: inputUserName,
                    role: categorySelection,
                    organizationId: user.organizationId
                }
            });
            setIsEditing(false);
            setIsEditSuccess(true);
            timer = setTimeout(() => {
                setIsEditSuccess(false);
                setInputUserName("");
            }, 3000);
        } catch (error) {
            toast("User updated failed", { type: "error" });
        } finally {
            toast("User updated successfully", { type: "success" });
            setIsSavingUser(false);
            setDataLoad(!dataLoad);
        }
    };
    const [showModal, setShowModal] = useState(false);
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);

    useEffect(() => {
        if (isEditing) {
            setShowModal(true);
        } else {
            const timer = setTimeout(() => setShowModal(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isEditing]);

    return (
        <>
            <div className={styles.page_container}>
                <>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "1.5rem",
                            gap: "5px"
                        }}
                    >
                        <div style={{ display: "flex", flex: 1 }}>
                            <div style={{ position: "relative", flex: 1 }}>
                                <span
                                    style={{
                                        position: "absolute",
                                        left: 12,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        zIndex: 1,
                                        color: "#9ca3af",
                                        pointerEvents: "none",
                                        paddingBottom: "1px"
                                    }}
                                >
                                    <Search size={16} />
                                </span>
                                <TextField
                                    className={styles.responsiveSearch}
                                    placeholder="Search Users..."
                                    value={search}
                                    styles={{
                                        fieldGroup: {
                                            height: "40px",
                                            paddingLeft: 36,
                                            borderRadius: "0.5rem",
                                            border: "1px solid #e5e7eb",
                                            position: "relative",
                                            selectors: {
                                                "::after": {
                                                    borderRadius: "0.5rem"
                                                }
                                            }
                                        },
                                        field: {
                                            fontSize: "16px",
                                            selectors: {
                                                ":focus": {
                                                    outline: "none"
                                                },
                                                ":focus-visible": {
                                                    outline: "none"
                                                },
                                                "::placeholder": {
                                                    color: "#9ca3af",
                                                    fontSize: "16px"
                                                }
                                            }
                                        },
                                        root: {
                                            selectors: {
                                                ":focus-within": {
                                                    outline: "none"
                                                },
                                                "::after": {
                                                    border: "none !important",
                                                    display: "none !important"
                                                }
                                            }
                                        },
                                        suffix: {
                                            background: "white !important",
                                            color: "#9ca3af",
                                            padding: "0px 8px",
                                            borderRadius: "0 0.5rem 0.5rem 0"
                                        }
                                    }}
                                    onChange={(_ev, newValue) => {
                                        setSearch(newValue || "");
                                    }}
                                    onRenderSuffix={() =>
                                        search ? (
                                            <button
                                                type="button"
                                                aria-label="Clear search"
                                                onClick={() => setSearch("")}
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    padding: 0,
                                                    cursor: "pointer",
                                                    color: "#9ca3af",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center"
                                                }}
                                            >
                                                <X size={16} />
                                            </button>
                                        ) : null
                                    }
                                />
                            </div>

                            <div style={{ position: "relative" }}>
                                <button className={styles.filterButton} type="button" onClick={() => setShowRoleDropdown(v => !v)}>
                                    <Filter className={styles.addIcon2} />
                                    <span className={styles.hideOnMobile}>{roleFilterOptions.find(opt => opt.value === roleFilter)?.label || "Filter"}</span>
                                </button>
                                {showRoleDropdown && (
                                    <div
                                        className={styles.dropdownMenu}
                                        style={{
                                            position: "absolute",
                                            top: "110%",
                                            left: 0,
                                            background: "white",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "0.5rem",
                                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                            zIndex: 10,
                                            minWidth: 140
                                        }}
                                    >
                                        {roleFilterOptions.map(option => (
                                            <div
                                                key={option.value}
                                                className={styles.dropdownItem}
                                                onClick={() => {
                                                    setRoleFilter(option.value);
                                                    setShowRoleDropdown(false);
                                                }}
                                                style={{
                                                    padding: "8px 16px",
                                                    cursor: "pointer",
                                                    fontWeight: roleFilter === option.value ? "bold" : "normal",
                                                    background: roleFilter === option.value ? "#f3f4f6" : "white"
                                                }}
                                            >
                                                {option.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <PrimaryButton
                            className={`${styles.option} ${styles.responsiveButton}`}
                            disabled={loading}
                            styles={{
                                root: {
                                    backgroundColor: "#16a34a",
                                    color: "white",
                                    border: "none"
                                },
                                rootHovered: {
                                    backgroundColor: "#15803d",
                                    color: "white"
                                },
                                rootFocused: {
                                    outline: "none",
                                    boxShadow: "0 0 0 2px white, 0 0 0 4px #22c55e"
                                },
                                rootPressed: {
                                    backgroundColor: "#15803d",
                                    color: "white"
                                }
                            }}
                            onClick={() => {
                                setIsOpen(true);
                            }}
                        >
                            <CirclePlus className={styles.addIcon} />
                            <span className={styles.buttonText}>Create User</span>
                        </PrimaryButton>
                    </div>

                    {loading ? null : <CreateUserForm isOpen={isOpen} setIsOpen={setIsOpen} users={users} />}
                    <DeleteUserDialog
                        isOpen={isDeleting}
                        onDismiss={() => {
                            setIsDeleting(false);
                        }}
                        onConfirm={() => {
                            deleteUserFromOrganization(selectedUser?.id);
                        }}
                        isDeletingUser={isDeletingUser}
                        userName={selectedUser?.data?.name}
                    />
                    <EditUserDialog
                        isOpen={showModal && isEditing}
                        onDismiss={() => {
                            setInputEmailName("");
                            setInputUserName("");
                            setIsEditing(false);
                        }}
                        onConfirm={userId => editUser(userId)}
                        selectedUser={selectedUser}
                        inputUserName={inputUserName}
                        inputEmailName={inputEmailName}
                        categorySelection={categorySelection}
                        roleOptions={roleOptions}
                        errorMessage={errorMessage}
                        handleInputName={handleInputName}
                        handleTypeDropdownChange={handleTypeDropdownChange}
                        isSavingUser={isSavingUser}
                        setInputUserName={setInputUserName}
                        setCategorySelection={setCategorySelection}
                    />
                    <DeleteInvitationDialog
                        isOpen={showDeleteInvitationModal}
                        onDismiss={() => setShowDeleteInvitationModal(false)}
                        onConfirm={invitationId => deleteInvitationFromOrganization(invitationId)}
                        selectedInvitation={selectedInvitation}
                        isDeletingUser={isDeletingUser}
                    />
                    {loading ? (
                        <Spinner
                            styles={{
                                root: {
                                    marginTop: "50px"
                                }
                            }}
                        />
                    ) : (
                        <ul className={styles.tableContainer} style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            <li
                                style={{
                                    background: "#00a63e",
                                    color: "white",
                                    fontWeight: 600,
                                    fontSize: 16,
                                    borderTopLeftRadius: 8,
                                    borderTopRightRadius: 8,
                                    padding: "12px 16px",
                                    marginBottom: 0
                                }}
                            >
                                Team Members
                            </li>
                            {filteredUsers.map((user: any, index) => {
                                const isNew = user.user_new;
                                const userName = isNew ? user.nickname : user.data.name;
                                const userEmail = isNew ? user.data.email : user.data.email;
                                const userRole = user.role;
                                const hasCreatedAccount = user.user_account_created;

                                // Verify if the invited user has accepted the invitation
                                let userStatus = "Active";
                                let statusColor = "#e5e7eb";
                                let statusTextColor = "#1e2939";
                                if (isNew) {
                                    const now = Math.floor(Date.now() / 1000);
                                    if (user.token_expiry && Number(user.token_expiry) < now) {
                                        userStatus = "Expired";
                                        statusColor = "#fee2e2";
                                        statusTextColor = "#b91c1c";
                                    } else {
                                        userStatus = "Invited";
                                        statusColor = "#fef9c2";
                                        statusTextColor = "#894b00";
                                    }
                                }

                                return (
                                    <li
                                        key={user.id || userEmail}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "1rem 1rem 1rem 1rem",
                                            borderBottom: "1px solid #e5e7eb",
                                            backgroundColor: index % 2 === 0 ? "#f8f8f8" : "white"
                                        }}
                                    >
                                        {/* Info: name, email, role */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ fontWeight: 600, color: "#111827", fontSize: "14px" }}>{userName}</span>
                                                <span className={roleStyles[userRole as "admin" | "user" | "platformAdmin"] || ""}>
                                                    {userRole === "platformAdmin" ? "Platform Admin" : userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: "0.75rem",
                                                        background: statusColor,
                                                        color: statusTextColor,
                                                        borderRadius: 8,
                                                        padding: "2px 10px",
                                                        marginLeft: 4,
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {userStatus}
                                                </span>
                                                {!hasCreatedAccount && (
                                                    <span
                                                        style={{
                                                            fontSize: "0.75rem",
                                                            background: "#ffffffff",
                                                            color: "#000000ff",
                                                            border: "1px solid #000000ff",
                                                            borderRadius: 8,
                                                            padding: "2px 10px",
                                                            marginLeft: 4,
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        No Account
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ color: "#6B7280", fontSize: "14px" }}>{userEmail}</span>
                                        </div>
                                        {/* Actions */}
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            {!isNew ? (
                                                <>
                                                    <button
                                                        className={styles.button}
                                                        title="Edit user"
                                                        aria-label="Edit user"
                                                        onClick={() => handleEditClick(user)}
                                                    >
                                                        <SquarePen className={styles.bothIcons} />
                                                    </button>
                                                    <button
                                                        className={styles.button}
                                                        title="Delete user"
                                                        aria-label="Delete user"
                                                        onClick={() => handleDeleteClick(user)}
                                                    >
                                                        <Trash2 className={styles.bothIcons} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        className={styles.button}
                                                        title="Delete invitation"
                                                        aria-label="Delete invitation"
                                                        onClick={() => {
                                                            setSelectedInvitation(user);
                                                            setShowDeleteInvitationModal(true);
                                                        }}
                                                    >
                                                        <Trash2 className={styles.bothIcons} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            </div>
        </>
    );
};

export default Admin;
