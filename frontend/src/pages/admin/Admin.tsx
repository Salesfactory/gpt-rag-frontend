import React, { useEffect, useState, ReactNode, useContext } from "react";
import { PrimaryButton, IconButton, Spinner, Dialog, DialogContent, Label, Dropdown, DefaultButton, MessageBar } from "@fluentui/react";
import { Announced } from "@fluentui/react/lib/Announced";
import { TextField, ITextFieldStyles } from "@fluentui/react/lib/TextField";
import { DetailsList, DetailsListLayoutMode, Selection, IColumn } from "@fluentui/react/lib/DetailsList";
import { MarqueeSelection } from "@fluentui/react/lib/MarqueeSelection";
import { mergeStyles } from "@fluentui/react/lib/Styling";
import { AppContext } from "../../providers/AppProviders";
import DOMPurify from "dompurify";

import { checkUser, getUsers, inviteUser } from "../../api";

import styles from "./Admin.module.css";

const exampleChildClass = mergeStyles({
    display: "block",
    marginBottom: "10px"
});

const textFieldStyles: Partial<ITextFieldStyles> = { root: { maxWidth: "300px" } };

export interface IUserListItem {
    key: number;
    name: string;
    email: string;
    role: string;
    actions: ReactNode;
}

export interface IUserListState {
    items: IUserListItem[];
    selectionDetails: string;
}

export class UserList extends React.Component<
    {
        users: any[];
    },
    IUserListState
> {
    private _selection: Selection;
    private _allItems: IUserListItem[];
    private _columns: IColumn[];

    constructor(props: { users: any[] }) {
        super(props);

        this._selection = new Selection({
            onSelectionChanged: () => this.setState({ selectionDetails: this._getSelectionDetails() })
        });

        // Populate with items for demos.
        this._allItems = props.users.map((user, index) => {
            return {
                key: user.id,
                name: user.data.name,
                email: user.data.email,
                role: user.data.role,
                value: index,
                actions: actions({})
            };
        });

        this._columns = [
            { key: "column1", name: "Name", fieldName: "name", minWidth: 100, maxWidth: 200, isResizable: true },
            { key: "column2", name: "Email", fieldName: "email", minWidth: 200, maxWidth: 300, isResizable: true },
            { key: "column3", name: "Role", fieldName: "role", minWidth: 100, maxWidth: 100, isResizable: false },
            { key: "column4", name: "Actions", fieldName: "actions", minWidth: 200, maxWidth: 300, isResizable: true }
        ];

        this.state = {
            items: this._allItems,
            selectionDetails: this._getSelectionDetails()
        };
    }

    public render(): JSX.Element {
        const { items, selectionDetails } = this.state;
        return (
            <div>
                <div className={exampleChildClass}>{selectionDetails}</div>
                <Announced message={selectionDetails} />
                <TextField className={exampleChildClass} label="Filter by name:" onChange={this._onFilter} styles={textFieldStyles} />
                <Announced message={`Number of items after filter applied: ${items.length}.`} />
                <MarqueeSelection selection={this._selection}>
                    <DetailsList
                        items={items}
                        columns={this._columns}
                        setKey="set"
                        layoutMode={DetailsListLayoutMode.justified}
                        selection={this._selection}
                        ariaLabelForSelectionColumn="Toggle selection"
                        ariaLabelForSelectAllCheckbox="Toggle selection for all items"
                        checkButtonAriaLabel="select row"
                        onItemInvoked={this._onItemInvoked}
                    />
                </MarqueeSelection>
                {this._allItems.length === 0 && (
                    <div>
                        <h3>No users found</h3>
                    </div>
                )}
            </div>
        );
    }

    private _getSelectionDetails(): string {
        const selectionCount = this._selection.getSelectedCount();

        switch (selectionCount) {
            case 0:
                return "No items selected";
            case 1:
                return "1 item selected: " + (this._selection.getSelection()[0] as IUserListItem).name;
            default:
                return `${selectionCount} items selected`;
        }
    }

    private _onFilter = (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, text: string | undefined): void => {
        this.setState({
            items: text ? this._allItems.filter(i => i.name.toLowerCase().indexOf(text.toLowerCase()) > -1) : this._allItems
        });
    };

    private _onItemInvoked = (item: IUserListItem): void => {
        alert(`Item invoked: ${item.name}`);
    };
}

const actions: React.FC = () => {
    const iconStyle = {
        icon: { color: "black" },
        root: {
            selectors: {
                ":hover .ms-Button-icon": {
                    color: "rgb(0, 120, 212);"
                }
            }
        }
    };
    return (
        <div>
            <IconButton styles={iconStyle} iconProps={{ iconName: "Chart" }} title="Show user expending" ariaLabel="Show user expending" onClick={() => {}} />
            <IconButton styles={iconStyle} iconProps={{ iconName: "Delete" }} title="Delete user" ariaLabel="Delete user" onClick={() => {}} />
        </div>
    );
};

export const CreateUserForm = ({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: React.Dispatch<React.SetStateAction<boolean>> }) => {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("user");

    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const isValidated = () => {
        const sanitizedUsername = DOMPurify.sanitize(username);
        const sanitizedEmail = DOMPurify.sanitize(email);
        if (!sanitizedUsername || !sanitizedEmail) {
            setErrorMessage("Please fill in all fields");
            return false;
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            setErrorMessage("Please provide a valid email address");
            return false;
        }
        return true;
    };

    const handleSubmit = () => {
        if (!isValidated()) return;
        setLoading(true);
        inviteUser({ username, email, role }).then(res => {
            if (res.error) {
                setErrorMessage(res.error);
            } else {
                setErrorMessage("");
                setLoading(false);
                setSuccess(true);
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

const Admin = () => {
    const { user } = useContext(AppContext);

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const getUserList = async () => {
            let usersList = await getUsers({});
            if (!Array.isArray(usersList)) {
                usersList = [];
            }
            setUsers(usersList);
            setLoading(false);
        };
        getUserList();
    }, []);

    return (
        <div className={styles.page_container}>
            <div id="options-row" className={styles.row}>
                <h1>Roles and access</h1>
                <PrimaryButton
                    className={styles.option}
                    text="Create user"
                    onClick={() => {
                        setIsOpen(true);
                    }}
                />
            </div>
            <CreateUserForm isOpen={isOpen} setIsOpen={setIsOpen} />
            <div>
                {loading ? (
                    <Spinner
                        styles={{
                            root: {
                                marginTop: "50px"
                            }
                        }}
                    />
                ) : (
                    <UserList users={users} />
                )}
            </div>
        </div>
    );
};

export default Admin;
