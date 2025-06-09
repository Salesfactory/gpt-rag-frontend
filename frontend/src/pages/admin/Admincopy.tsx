import React, { useEffect, useState, useContext } from "react";
import { PrimaryButton, Spinner, Dialog, DialogContent, Label, Dropdown, DefaultButton, MessageBar, ResponsiveMode } from "@fluentui/react";
import { ToastContainer, toast } from "react-toastify";
import { TextField, ITextFieldStyles } from "@fluentui/react/lib/TextField";
import { CirclePlus, Search, SquarePen, Trash2, Filter } from "lucide-react";

import { useAppContext } from "../../providers/AppProviders";
import DOMPurify from "dompurify";

import { getUsers, inviteUser, createInvitation, deleteUser, updateUserData } from "../../api";

import styles from "./Admincopy.module.css";

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
        // Sanitize inputs
        const sanitizedUsername = DOMPurify.sanitize(username);
        const sanitizedEmail = DOMPurify.sanitize(email).replace(/\s+/g, "").toLowerCase();

        // Validate inputs
        if (!isValidated(sanitizedUsername, sanitizedEmail)) return;

        // Check if user already exists
        if (alreadyExists(sanitizedEmail)) {
            setErrorMessage("User with this email already exists");
            return;
        }

        // Check if `user` is not null
        if (!user) {
            // Handle unauthenticated user
            setErrorMessage("You must be logged in to invite a user.");
            return;
        }

        setLoading(true);

        try {
            const organizationId = user.organizationId;
            const organizationName = organization?.name;

            const invitationResponse = await createInvitation({
                organizationId,
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
            console.error("Error during invitation process:", error);
            setErrorMessage("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const onUserNameChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setUsername(newValue || "");
    };

    const onEmailChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setEmail(newValue || "");
    };

    const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault();
            handleSubmit();
        }
    };

    const roleOptions = [
        { key: "1", text: "user" },
        { key: "2", text: "admin" }
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

    return (
        <Dialog
            minWidth={800}
            closeButtonAriaLabel="Close"
            isClickableOutsideFocusTrap={true}
            hidden={!isOpen}
            onDismiss={onDismiss}

            dialogContentProps={
                !success
                    ? {
                          type: 0,
                          title: "Create a new user",
                          subText: "Invite a new user to the platform by providing their username and email.",
                          styles: {
                              title: { fontSize: 16 },
                              subText: { fontSize: 16 }
                          }
                      }
                    : undefined
            }
            modalProps={{
                isBlocking: true,
                onDismiss: onDismiss,
                styles: { main: { maxWidth: 450, borderRadius: "6px" } }
            }}
        >
            {loading && (
                <Spinner
                    styles={{
                        root: {
                            marginTop: "50px"
                        }
                    }}
                />
            )}
            {!success && !loading && (
                <DialogContent>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: "10px",
                            marginBottom: "10px"
                        }}
                    >
                        <div style={{ width: "100%" }}>
                            <Label style={{ fontSize: 16 }}>Username</Label>
                            <TextField
                                className={styles.questionInputTextArea}
                                placeholder={"Username"}
                                resizable={false}
                                value={username}
                                onChange={onUserNameChange}
                                onKeyDown={onEnterPress}
                                styles={{
                                    fieldGroup: {
                                        borderRadius: "6px"
                                    },
                                    field: {
                                        fontSize: 16,
                                        "::placeholder": {
                                            color: "#979797",
                                            fontSize: 16
                                        }
                                    }
                                }}
                            />
                        </div>
                        <div style={{ width: "100%" }}>
                            <Label style={{ fontSize: 16 }}>Email</Label>
                            <TextField
                                className={styles.questionInputTextArea}
                                placeholder={"Email"}
                                resizable={false}
                                value={email}
                                onChange={onEmailChange}
                                onKeyDown={onEnterPress}
                                styles={{
                                    fieldGroup: {
                                        borderRadius: "6px"
                                    },
                                    field: {
                                        fontSize: 16,
                                        "::placeholder": {
                                            color: "#979797",
                                            fontSize: 16
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <Label style={{ fontSize: 16 }}>User Role</Label>
                    <Dropdown
                        placeholder="Select Role"
                        options={roleOptions}
                        onChange={handleRoleChange}
                        defaultValue={role}
                        styles={{
                            title: { borderRadius: "6px", color: "#979797", fontSize: 16 },
                            dropdown: { fontSize: 16 }
                        }}
                    />
                    {errorMessage && (
                        <MessageBar messageBarType={2} styles={{ root: { fontSize: 16 } }}>
                            {errorMessage}
                        </MessageBar>
                    )}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "end",
                            gap: "10px"
                        }}
                    >
                        <DefaultButton style={{ marginTop: "20px", borderRadius: "6px", fontSize: 16 }} onClick={onDismiss} text="Cancel" />
                        <PrimaryButton
                            styles={{
                                root: {
                                    backgroundColor: "#16a34a",
                                    borderColor: "#16a34a",
                                    color: "white",
                                    borderRadius: "0.5rem",
                                    fontSize: 16
                                },
                                rootHovered: {
                                    backgroundColor: "#15803d",
                                    borderColor: "#15803d",
                                    color: "white"
                                },
                                rootPressed: {
                                    backgroundColor: "#15803d",
                                    borderColor: "#15803d",
                                    color: "white"
                                }
                            }}
                            style={{ marginTop: "20px" }}
                            onClick={() => {
                                onConfirm();
                            }}
                            text="Send Invitation"
                        />
                    </div>
                </DialogContent>
            )}
            {success && (
                <DialogContent>
                    <div>
                        <h3 style={{ fontSize: 16 }}>Invitation Sent</h3>
                        <p style={{ fontSize: 16 }}>
                            An invitation has been sent to <strong>{email}</strong>. They will receive an email with a link to create an account.
                        </p>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "end",
                            gap: "10px"
                        }}
                    >
                        <PrimaryButton style={{ fontSize: 16 }} onClick={onDismiss} text="Close" />
                    </div>
                </DialogContent>
            )}
        </Dialog>
    );
};

export const DeleteUserDialog = ({
    isOpen,
    onDismiss,
    onConfirm,
    isDeletingUser
}: {
    isOpen: boolean;
    onDismiss: any;
    onConfirm: any;
    isDeletingUser: boolean;
}) => {
    return (
        <Dialog
            minWidth={800}
            closeButtonAriaLabel="Close"
            isClickableOutsideFocusTrap={true}
            hidden={!isOpen}
            onDismiss={onDismiss}
            dialogContentProps={{
                type: 0,
                title: "Delete user",
                subText: "Are you sure you want to delete this user from your organization?"
            }}
            modalProps={{
                isBlocking: true,
                onDismiss: onDismiss,
                styles: { main: { maxWidth: 450 } }
            }}
        >
            {isDeletingUser && (
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 9999
                    }}
                >
                    <Spinner
                        styles={{
                            root: {
                                width: "50px",
                                height: "50px"
                            }
                        }}
                    />
                </div>
            )}
            <DialogContent>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "end",
                        gap: "10px"
                    }}
                >
                    <DefaultButton style={{ marginTop: "20px" }} onClick={onDismiss} text="Cancel" />
                    <PrimaryButton
                        styles={{
                            root: {
                                backgroundColor: "#16a34a",
                                borderColor: "#16a34a",
                                color: "white",
                                borderRadius: "0.5rem"
                            },
                            rootHovered: {
                                backgroundColor: "#15803d",
                                borderColor: "#15803d",
                                color: "white"
                            },
                            rootPressed: {
                                backgroundColor: "#15803d",
                                borderColor: "#15803d",
                                color: "white"
                            }
                        }}
                        style={{ marginTop: "20px" }}
                        onClick={() => {
                            onConfirm();
                        }}
                        text="Delete user"
                    />
                </div>
            </DialogContent>
        </Dialog>
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
        }
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
        { key: "1", text: "user" },
        { key: "2", text: "admin" }
    ];
    const [categorySelection, setCategorySelection] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const [dataLoad, setDataLoad] = useState(false);
    const [isEditSuccess, setIsEditSuccess] = useState(false);
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
            filtered = filtered.filter(
                (user: any) => user.data.name.toLowerCase().includes(search.toLowerCase()) || user.data.email.toLowerCase().includes(search.toLowerCase())
            );
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
        deleteUser({ user, userId: id }).then(res => {
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
            setErrorMessage("Please type the Username");
            setIsError(true);
            return;
        }
        if (inputEmailName == "") {
            setErrorMessage("Please type the Email");
            setIsError(true);
            return;
        }
        if (categorySelection == "") {
            setErrorMessage("Please select the Report Category");
            setIsError(true);
            return;
        }

        let timer: NodeJS.Timeout;

        try {
            await updateUserData({
                userId: userID,
                patchData: {
                    name: inputUserName,
                    email: inputEmailName,
                    role: categorySelection
                }
            });
            setIsEditing(false);
            setIsEditSuccess(true);
            timer = setTimeout(() => {
                setIsEditSuccess(false);
            }, 3000);
        } catch (error) {
            console.error("Error trying to update the state: ", error);
        } finally {
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
        <div className={styles.page_container}>
            <ToastContainer />
            <>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}
                >
                    <div style={{ display: "flex", gap: "12px", width: "100%", maxWidth: 600 }}>
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
                                <Search />
                            </span>
                            <TextField
                                className={styles.responsiveSearch}
                                placeholder="Search Users..."
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
                                    }
                                }}
                                onChange={(_ev, newValue) => {
                                    setSearch(newValue || "");
                                }}
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
                />
                {showModal && (
                    <>
                        <div className={styles.modalOverlay} onClick={() => setIsEditing(false)}></div>
                        <div className={`${styles.modal} ${!isEditing ? styles.modalHidden : ""}`}>
                            <Label className={styles.modalTitle}>Edit User</Label>
                            <form>
                                <Label
                                    styles={{
                                        root: { padding: "0px 0px 10px 0px" }
                                    }}
                                >
                                    User Name
                                </Label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    onChange={handleInputName}
                                    placeholder={selectedUser.data.name}
                                    value={inputUserName}
                                ></input>
                                <Label>User Email</Label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    onChange={handleInputEmail}
                                    placeholder={selectedUser.data.email}
                                    value={inputEmailName}
                                ></input>
                                <Label>Role</Label>
                                <Dropdown
                                    placeholder="Select a Role"
                                    options={roleOptions}
                                    onChange={handleTypeDropdownChange}
                                    defaultValue={categorySelection}
                                    responsiveMode={ResponsiveMode.unknown}
                                />
                                {isError && <span className={styles.modalError}>{errorMessage}</span>}

                                <DefaultButton style={{ marginTop: "50px", marginRight: "95px" }} onClick={() => setIsEditing(false)} text="Cancel" />
                                <PrimaryButton
                                    styles={{
                                        root: {
                                            backgroundColor: "#16a34a",
                                            borderColor: "#16a34a",
                                            color: "white",
                                            borderRadius: "0.5rem"
                                        },
                                        rootHovered: {
                                            backgroundColor: "#15803d",
                                            borderColor: "#15803d",
                                            color: "white"
                                        },
                                        rootPressed: {
                                            backgroundColor: "#15803d",
                                            borderColor: "#15803d",
                                            color: "white"
                                        }
                                    }}
                                    style={{ marginTop: "20px" }}
                                    onClick={() => {
                                        editUser(selectedUser.id);
                                    }}
                                    text="Edit User"
                                />
                            </form>
                        </div>
                    </>
                )}
                {isEditSuccess && (
                    <div className={styles.modalSuccess}>
                        <Label>User Edited successfully!</Label>
                    </div>
                )}
                {loading ? (
                    <Spinner
                        styles={{
                            root: {
                                marginTop: "50px"
                            }
                        }}
                    />
                ) : (
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th
                                        style={{
                                            padding: "10px",
                                            fontSize: "1rem",
                                            fontWeight: 600
                                        }}
                                    >
                                        Name
                                    </th>
                                    <th className={styles.tableTitle}>Email</th>
                                    <th className={styles.tableTitle}>Role</th>
                                    <th className={styles.tableTitle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user: any, index) => {
                                    return (
                                        <tr
                                            key={user.id}
                                            style={{
                                                backgroundColor: index % 2 === 0 ? "#f8f8f8" : "white"
                                            }}
                                        >
                                            <td
                                                style={{
                                                    fontSize: "14px",
                                                    fontWeight: 500,
                                                    color: "#111827",
                                                    padding: "10px",
                                                    textAlign: "justify"
                                                }}
                                            >
                                                {user.data.name}
                                            </td>
                                            <td
                                                style={{
                                                    fontSize: "14px",
                                                    color: "#6B7280",
                                                    textAlign: "justify"
                                                }}
                                            >
                                                {user.data.email}
                                            </td>
                                            <td>
                                                <div
                                                    style={{
                                                        width: "100%",
                                                        justifyContent: "flex-start",
                                                        justifyItems: "center",
                                                        textAlign: "center",
                                                        display: "flex",
                                                        textTransform: "capitalize"
                                                    }}
                                                >
                                                    <div className={roleStyles[user.role as "admin" | "user" | "platformAdmin"] || ""}>
                                                        {user.role === "platformAdmin" ? "Platform Admin" : user.role}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                {
                                                    <div>
                                                        <button
                                                            className={styles.button}
                                                            title="Edit user"
                                                            aria-label="Edit user"
                                                            onClick={() => {
                                                                handleEditClick(user);
                                                            }}
                                                        >
                                                            <SquarePen className={styles.bothIcons} />
                                                        </button>
                                                        <button
                                                            className={styles.button}
                                                            title="Delete user"
                                                            aria-label="Delete user"
                                                            onClick={() => {
                                                                handleDeleteClick(user);
                                                            }}
                                                        >
                                                            <Trash2 className={styles.bothIcons} />
                                                        </button>
                                                    </div>
                                                }
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </>
        </div>
    );
};

export default Admin;
