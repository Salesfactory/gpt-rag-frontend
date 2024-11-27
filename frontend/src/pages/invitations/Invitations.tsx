import React, { useEffect, useState, useContext } from "react";
import { Spinner } from "@fluentui/react";
import { TextField } from "@fluentui/react/lib/TextField";
import { SearchRegular } from "@fluentui/react-icons";

import { useAppContext } from "../../providers/AppProviders";

import { getInvitations } from "../../api";

import styles from "./Invitations.module.css";

interface User {
    id: number;
    invited_user_email: string;
    role: string;
    active: boolean;
}

const Invitations = () => {
    const { user } = useAppContext();
    const [search, setSearch] = useState("");
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getUserList = async () => {
            if (!user) {
                setUsers([]);
                setFilteredUsers([]);
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                let invitationsList = await getInvitations({
                    user: {
                        id: user.id,
                        username: user.name,
                        organizationId: user.organizationId
                    }
                });

                if (!Array.isArray(invitationsList)) {
                    invitationsList = [];
                }

                setUsers(invitationsList);
                setFilteredUsers(invitationsList);
            } catch (error) {
                console.error("Error fetching invitations:", error);
                setUsers([]);
                setFilteredUsers([]);
            } finally {
                setLoading(false);
            }
        };

        getUserList();
    }, [user]);

    useEffect(() => {
        if (!search) {
            setFilteredUsers(users);
        } else {
            const filtered = users.filter((user: any) => {
                return user.invited_user_email.toLowerCase().includes(search.toLowerCase());
            });
            setFilteredUsers(filtered);
        }
    }, [search]);

    if (!user) {
        return <div>Please log in to view your invitations.</div>;
    }


    return (
        <div className={styles.page_container}>
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
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Status</th>
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
                                            <td className={styles.textJustify}>{user.invited_user_email}</td>
                                            <td>
                                                <div className={styles.roleContainer}>
                                                    <div
                                                        style={{
                                                            backgroundColor: user.role === "admin" ? "#d7e9f4" : "#d7e5be",
                                                            color: user.role === "admin" ? "#064789" : "#1b4332"
                                                        }}
                                                        className={styles.pillRole}
                                                    >
                                                        {user.role}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.roleContainer}>
                                                    <div
                                                        style={{
                                                            backgroundColor: user.active ? "#d7e9f4" : "#e0e0e0",
                                                            color: user.active ? "#064789" : "#ffffff"
                                                        }}
                                                        className={styles.pillRole}
                                                    >
                                                        {user.active ? "Active" : "Inactive"}
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
        </div>
    );
};

export default Invitations;
