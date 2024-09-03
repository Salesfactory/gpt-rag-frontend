import React, { useEffect, useState, useContext } from "react";
import { Spinner } from "@fluentui/react";
import { TextField } from "@fluentui/react/lib/TextField";
import { SearchRegular } from "@fluentui/react-icons";

import { AppContext } from "../../providers/AppProviders";

import { getInvitations } from "../../api";

import styles from "./Invitations.module.css";

interface User {
    id: number;
    data: {
        username: string;
        email: string;
        role: string;
    };
}

const Invitations = () => {
    const { user } = useContext(AppContext);
    const [search, setSearch] = useState("");
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getUserList = async () => {
            let invitationsList = await getInvitations({ user: { id: user.id, username: user.name, organizationId: user.organizationId } });
            if (!Array.isArray(invitationsList)) {
                invitationsList = [];
            }
            setUsers(invitationsList);
            setFilteredUsers(invitationsList);
            setLoading(false);
        };
        getUserList();
    }, []);

    useEffect(() => {
        if (!search) {
            setFilteredUsers(users);
        } else {
            const filtered = users.filter((user: any) => {
                return user.data.username.toLowerCase().includes(search.toLowerCase()) || user.data.email.toLowerCase().includes(search.toLowerCase());
            });
            setFilteredUsers(filtered);
        }
    }, [search]);

    return (
        <div className={styles.page_container}>
            {user.role !== "admin" && <h1>Access denied</h1>}
            {user.role === "admin" && (
                <>
                    <div id="options-row" className={styles.row}>
                        <h1 className={styles.title}>Invitations</h1>
                    </div>
                    <div className={styles.searchContainer}>
                        <TextField
                            placeholder="Search..."
                            style={{
                                width: "268px",
                                borderRadius: "6px",
                                border: "1px solid #9F9C9C",
                                padding: "0px 15px"
                            }}
                            styles={{
                                fieldGroup: {
                                    border: "none",
                                    borderRadius: "6px"
                                },
                                root: {
                                    border: "none"
                                },
                                field: {
                                    "::placeholder": {
                                        color: "#979797"
                                    }
                                }
                            }}
                            onChange={(_ev, newValue) => {
                                setSearch(newValue || "");
                            }}
                            iconProps={{
                                iconName: "Search",
                                children: <SearchRegular className={styles.searchIcon} />
                            }}
                        />
                    </div>
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
                                        <th>Username</th>
                                        <th>Email</th>
                                        <th>Role</th>
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
                                                <td className={styles.textJustify}>{user.data.username}</td>
                                                <td className={styles.textJustify}>{user.data.email}</td>
                                                <td>
                                                    <div className={styles.roleContainer}>
                                                        <div
                                                            style={{
                                                                backgroundColor: user.data.role === "admin" ? "#d7e9f4" : "#d7e5be",
                                                                color: user.data.role === "admin" ? "#064789" : "#1b4332"
                                                            }}
                                                            className={styles.pillRole}
                                                        >
                                                            {user.data.role}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Invitations;
