import React, { useEffect, useState, useContext } from "react";
import { PrimaryButton, IconButton, Spinner, Dialog, DialogContent, Label, Dropdown, DefaultButton, MessageBar } from "@fluentui/react";
import { ToastContainer, toast } from "react-toastify";
import { TextField, ITextFieldStyles } from "@fluentui/react/lib/TextField";
import { AddFilled } from "@fluentui/react-icons";

import { AppContext } from "../../providers/AppProviders";
import DOMPurify from "dompurify";

import { checkUser, getUsers, inviteUser, createInvitation, deleteUser } from "../../api";

import styles from "./Admin.module.css";

const textFieldStyles: Partial<ITextFieldStyles> = { root: { maxWidth: "900px" } };
export const CreateUserForm = ({ isOpen, setIsOpen, users }: { isOpen: boolean; setIsOpen: React.Dispatch<React.SetStateAction<boolean>>; users: never[] }) => {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("user");
    const { user } = useContext(AppContext);

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
        return users.some((user: any) => user.data.email === sanitizedEmail);
    };

    const handleSubmit = () => {
        const sanitizedUsername = DOMPurify.sanitize(username);
        const sanitizedEmail = DOMPurify.sanitize(email);
        if (!isValidated(sanitizedUsername, sanitizedEmail)) return;
        if (alreadyExists(sanitizedEmail)) return setErrorMessage("User with this email already exists");
        setLoading(true);

        const organizationId = user.organizationId;
        inviteUser({ username: sanitizedUsername, email: sanitizedEmail, role, organizationId }).then(res => {
            if (res.error) {
                setErrorMessage(res.error);
            } else {
                createInvitation({ organizationId, invitedUserEmail: sanitizedEmail, userId: user.id }).then(res => {
                    if (res.error) {
                        setErrorMessage(res.error);
                    } else {
                        setErrorMessage("");
                        setLoading(false);
                        setSuccess(true);
                    }
                });
            }
        });
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
            dialogContentProps={{
                type: 0,
                title: "Create a new user",
                subText: "Invite a new user to the platform by providing their username and email."
            }}
            modalProps={{
                isBlocking: true,
                onDismiss: onDismiss,
                styles: { main: { maxWidth: 450 } }
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
                            gap: "10px"
                        }}
                    >
                        <div
                            style={{
                                width: "100%"
                            }}
                        >
                            <Label>Username</Label>
                            <TextField
                                className={styles.questionInputTextArea}
                                placeholder={"Username"}
                                resizable={false}
                                value={username}
                                onChange={onUserNameChange}
                                onKeyDown={onEnterPress}
                            />
                        </div>
                        <div
                            style={{
                                width: "100%"
                            }}
                        >
                            <Label>Email</Label>
                            <TextField
                                className={styles.questionInputTextArea}
                                placeholder={"Email"}
                                resizable={false}
                                value={email}
                                onChange={onEmailChange}
                                onKeyDown={onEnterPress}
                            />
                        </div>
                    </div>
                    <Label>User role</Label>
                    <Dropdown placeholder="Select Role" options={roleOptions} onChange={handleRoleChange} defaultValue={role} />
                    {errorMessage && <MessageBar messageBarType={2}>{errorMessage}</MessageBar>}
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
                                    backgroundColor: "#9FC51D",
                                    borderColor: "#9FC51D",
                                    color: "white",
                                    borderRadius: "5px"
                                },
                                rootHovered: {
                                    backgroundColor: "#ACC41D",
                                    borderColor: "#ACC41D",
                                    color: "white"
                                },
                                rootPressed: {
                                    backgroundColor: "#9FC51D",
                                    borderColor: "#9FC51D",
                                    color: "white"
                                }
                            }}
                            style={{ marginTop: "20px" }}
                            onClick={() => {
                                onConfirm();
                            }}
                            text="Send invitation"
                        />
                    </div>
                </DialogContent>
            )}
            {success && (
                <DialogContent>
                    <div>
                        <h3>Invitation sent</h3>
                        <p>
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
                        <PrimaryButton onClick={onDismiss} text="Close" />
                    </div>
                </DialogContent>
            )}
        </Dialog>
    );
};

export const DeleteUserDialog = ({
    isOpen,
    onDismiss,
    onConfirm
}: {
    isOpen: boolean;
    onDismiss: any;
    onConfirm: any;
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
                                backgroundColor: "#9FC51D",
                                borderColor: "#9FC51D",
                                color: "white",
                                borderRadius: "5px"
                            },
                            rootHovered: {
                                backgroundColor: "#ACC41D",
                                borderColor: "#ACC41D",
                                color: "white"
                            },
                            rootPressed: {
                                backgroundColor: "#9FC51D",
                                borderColor: "#9FC51D",
                                color: "white"
                            }
                        }}
                        style={{ marginTop: "20px" }}
                        onClick={()  => {
                            onConfirm()
                        }}
                        text="Delete user"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
};

const Admin = () => {
    const { user } = useContext(AppContext);
    const [search, setSearch] = useState("");
    const [filteredUsers, setFilteredUsers] = useState([]);
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

    useEffect(() => {
        const getUserList = async () => {
            let usersList = await getUsers({});
            if (!Array.isArray(usersList)) {
                usersList = [];
            }
            setUsers(usersList);
            setFilteredUsers(usersList);
            setLoading(false);
        };
        getUserList();
    }, []);

    useEffect(() => {
        if (!search) {
            setFilteredUsers(users);
        } else {
            const filtered = users.filter((user: any) => {
                return user.data.name.toLowerCase().includes(search.toLowerCase()) || user.data.email.toLowerCase().includes(search.toLowerCase());
            });
            setFilteredUsers(filtered);
        }
    }, [search]);

    const deleteUserFromOrganization = (id: string) => {
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
        });
    };

    return (
        <div className={styles.page_container}>
            <ToastContainer />
            {user.role !== "admin" && <h1>Access denied</h1>}
            {user.role === "admin" && (
                <>
                    <div className={styles.buttons}>
                        <div className={styles.closeButtonContainer}>
                            <button
                                className={styles.closeButton}
                                aria-label="hide button"
                                onClick={() => {
                                    window.location.href = "/";
                                }}
                            >
                                <AddFilled />
                            </button>
                        </div>
                    </div>
                    <div id="options-row" className={styles.row}>
                        <h1>Roles and access</h1>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center"
                        }}
                    >
                        <PrimaryButton
                            style={{
                                flex: 0.2
                            }}
                            className={styles.option}
                            styles={{
                                root: {
                                    backgroundColor: "#9FC51D",
                                    borderColor: "#9FC51D",
                                    color: "white",
                                    borderRadius: "5px"
                                },
                                rootHovered: {
                                    backgroundColor: "#ACC41D",
                                    borderColor: "#ACC41D",
                                    color: "white"
                                },
                                rootPressed: {
                                    backgroundColor: "#9FC51D",
                                    borderColor: "#9FC51D",
                                    color: "white"
                                }
                            }}
                            text="Create user"
                            onClick={() => {
                                setIsOpen(true);
                            }}
                        />
                        <TextField
                            placeholder="Search..."
                            style={{
                                width: "300px"
                            }}
                            styles={textFieldStyles}
                            onChange={(_ev, newValue) => {
                                setSearch(newValue || "");
                            }}
                        />
                    </div>

                    <CreateUserForm isOpen={isOpen} setIsOpen={setIsOpen} users={users} />
                    <DeleteUserDialog
                        isOpen={isDeleting}
                        onDismiss={() => {
                            setIsDeleting(false);
                        }}
                        onConfirm={() => {
                            deleteUserFromOrganization(selectedUser?.id);
                        }}
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
                        <table
                            style={{
                                textAlign: "center",
                                marginTop: "20px",
                                backgroundColor: "white",
                                borderCollapse: "collapse"
                            }}
                        >
                            <thead
                                style={{
                                    backgroundColor: "#9FC51D",
                                    color: "white"
                                }}
                            >
                                <tr>
                                    <th
                                        style={{
                                            padding: "10px"
                                        }}
                                    >
                                        Name
                                    </th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user: any, index) => {
                                    return (
                                        <>
                                            <tr
                                                key={user.id}
                                                style={{
                                                    backgroundColor: index % 2 === 0 ? "#f8f8f8" : "white"
                                                }}
                                            >
                                                <td
                                                    style={{
                                                        padding: "10px",
                                                        textAlign: "justify"
                                                    }}
                                                >
                                                    {user.data.name}
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: "justify"
                                                    }}
                                                >
                                                    {user.data.email}
                                                </td>
                                                <td>
                                                    <div
                                                        style={{
                                                            width: "100%",
                                                            justifyContent: "center",
                                                            justifyItems: "center",
                                                            display: "flex"
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: "100px",
                                                                backgroundColor: user.data.role === "admin" ? "#d7e9f4" : "#d7e5be",
                                                                padding: "5px",
                                                                color: user.data.role === "admin" ? "#064789" : "#1b4332",
                                                                borderRadius: "15px"
                                                            }}
                                                        >
                                                            {user.data.role}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    {
                                                        <div>
                                                            <IconButton
                                                                style={{
                                                                    color: "black"
                                                                }}
                                                                iconProps={{ iconName: "Edit" }}
                                                                title="Edit user"
                                                                ariaLabel="Edit user"
                                                                onClick={() => {}}
                                                            />
                                                            <IconButton
                                                                style={{
                                                                    color: "black"
                                                                }}
                                                                iconProps={{ iconName: "Delete", color: "black" }}
                                                                title="Delete user"
                                                                ariaLabel="Delete user"
                                                                onClick={() => {
                                                                    setSelectedUser(user);
                                                                    setIsDeleting(true);
                                                                }}
                                                            />
                                                        </div>
                                                    }
                                                </td>
                                            </tr>
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </>
            )}
        </div>
    );
};

export default Admin;
