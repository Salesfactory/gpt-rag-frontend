import React, { useEffect, useState } from "react";
import styles from "./DistributionListscopy.module.css";
import { useAppContext } from "../../providers/AppProviders";
import { getUsers, updateUser } from "../../api";
import { Mail, Search, Filter } from "lucide-react";
import { Spinner, TextField } from "@fluentui/react";

const roleOptions = [
    { label: "All", value: "" },
    { label: "Admin", value: "admin" },
    { label: "User", value: "user" },
    { label: "Platform Admin", value: "platformAdmin" }
];

const DistributionLists: React.FC = () => {
    const { user } = useAppContext();
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
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
    const [dataLoad, setDataLoad] = useState(false);
    const [roleFilter, setRoleFilter] = useState("");
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);
    const roleStyles: { [key in "admin" | "user" | "platformAdmin"]: string } = {
        admin: styles.roleAdmin,
        user: styles.roleUser,
        platformAdmin: styles.rolePlatformAdmin
    };

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
                let usersList = await getUsers({
                    user: {
                        id: user.id,
                        name: user.name,
                        organizationId: user.organizationId,
                        isReportEmailReceiver: user.isReportEmailReceiver
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

    const handleCheckbox = async (userID: string, IsEmailReceiver: string | boolean) => {
        const newValue = IsEmailReceiver === "true" ? "false" : "true";
        try {
            await updateUser({
                userId: userID,
                updatedData: { isReportEmailReceiver: newValue }
            });
            setDataLoad(!dataLoad);
        } catch (error) {
            console.error("Error trying to update the state: ", error);
        }
    };

    useEffect(() => {
        let filtered = users.filter(
            (u: any) =>
                (u.data.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.data.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
                (roleFilter === "" || u.data.role === roleFilter)
        );
        setFilteredUsers(filtered);
    }, [searchTerm, users, roleFilter]);

    return (
        <div className={styles.page_container}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                {/* Search */}
                <div style={{ position: "relative", flex: 1 }}>
                    <span
                        style={{
                            position: "absolute",
                            left: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            zIndex: 1,
                            color: "#99a1af",
                            pointerEvents: "none",
                            paddingBottom: "2px"
                        }}
                    >
                        <Search size={18} />
                    </span>
                    <TextField
                        className={styles.responsiveSearch}
                        placeholder="Search distribution list..."
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
                                        color: "#9ca3af"
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
                        value={searchTerm}
                        onChange={(_, value) => setSearchTerm(value || "")}
                    />
                </div>
                {/* Filter Button */}
                <div style={{ position: "relative" }}>
                    <button className={styles.filterButton} onClick={() => setShowRoleDropdown(v => !v)}>
                        <Filter size={18} style={{ marginRight: 6 }} />
                        Filter
                    </button>
                    {showRoleDropdown && (
                        <div className={styles.dropdownMenu}>
                            {roleOptions.map(option => (
                                <div
                                    key={option.value}
                                    className={styles.dropdownItem}
                                    onClick={() => {
                                        setRoleFilter(option.value);
                                        setShowRoleDropdown(false);
                                    }}
                                    style={{
                                        fontWeight: roleFilter === option.value ? "bold" : "normal"
                                    }}
                                >
                                    {option.label}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className={styles.tableContainer}>
                {loading ? (
                    <Spinner styles={{ root: { marginTop: "50px", marginBottom: "50px" } }} />
                ) : (
                    <table className={styles.table}>
                        <thead className={styles.thead}>
                            <tr>
                                <th className={styles.tableHeaderCell}>Name</th>
                                <th className={styles.tableHeaderCellEmail}>Email</th>
                                <th className={styles.tableHeaderCellEmail}>Role</th>
                                <th className={styles.tableHeaderCell}>Email Receiver</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user: any, index) => {
                                return (
                                    <tr key={user.id} className={`${index % 2 === 0 ? styles.userBackground : styles.userBackgroundAlt}`}>
                                        <td className={styles.nameElement}>{user.data.name}</td>
                                        <td className={styles.text}>
                                            <div className={styles.emailWithIcon}>
                                                <Mail size={16} className={styles.icon} />
                                                <span>{user.data.email}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.roleContainer}>
                                                <div className={roleStyles[user.data.role as "admin" | "user" | "platformAdmin"] || ""}>{user.data.role}</div>
                                            </div>
                                        </td>
                                        <td>
                                            {
                                                <div className={styles.centered}>
                                                    <input
                                                        type="checkbox"
                                                        className={styles.checkbox}
                                                        checked={user.isReportEmailReceiver === "true" ? true : false}
                                                        onChange={() => handleCheckbox(user.id, user.isReportEmailReceiver)}
                                                    ></input>
                                                </div>
                                            }
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default DistributionLists;
