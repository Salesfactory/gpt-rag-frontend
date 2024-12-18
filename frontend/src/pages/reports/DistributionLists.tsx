import React, { useEffect, useState } from "react";
import styles from "./DistributionLists.module.css"
import { useAppContext } from "../../providers/AppProviders";
import { getUsers } from "../../api";

const DistributionLists: React.FC = () => {
    const { user } = useAppContext();
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
    }, [user]);
    

    return (
        <div className={styles.page_container}>
            <h1>Distribution Lists</h1>
            <p>Manage the organization email flow</p>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
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
                                <th>Report Sending</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user: any, index) => {
                                return (
                                    <tr key={user.id} className={`${index % 2 === 0 ? styles.userBackground : styles.userBackgroundAlt}`}>
                                        <td className={styles.nameElement}>
                                            {user.data.name}
                                        </td>
                                        <td className={styles.text}>
                                            {user.data.email}
                                        </td>
                                        <td>
                                            <div className={styles.roleContainer}>
                                                <div className={`${user.data.role === "admin" ? styles.roleAdmin : styles.roleUser}`}>
                                                    {user.data.role}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {
                                                <div>
                                                    <input type="checkbox" className={styles.checkbox}></input>
                                                </div>
                                            }
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
        </div>
    );
};

export default DistributionLists;
