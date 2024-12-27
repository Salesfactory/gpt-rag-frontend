import React, { useEffect, useState } from "react";
import styles from "./DistributionLists.module.css"
import { useAppContext } from "../../providers/AppProviders";
import { getUsers, updateUser } from "../../api";
import { Spinner } from "@fluentui/react";

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
    const [dataLoad, setDataLoad] = useState(false)

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
            try{
                await updateUser({
                    userId: userID,
                    updatedData: { isReportEmailReceiver: newValue }
                });
                setDataLoad(!dataLoad)
            } catch (error){
                console.error("Error trying to update the state: ", error)
            }
        
    }

    return (
        <div className={styles.page_container}>
            <div className={styles.title}>
                <h1>Distribution Lists</h1>
                <p>Manage the organization email flow</p>
            </div>
            <div className={styles.card}>
                <div className={styles.tableContainer}>
                    {loading ? (
                        <Spinner styles={{root: {marginTop: "50px", marginBottom: "50px"}}}/>
                    ) : (
                        <table className={styles.table}>
                            <thead className={styles.thead}>
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
                                    <th>Email Receiver</th>
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
                                                        <input type="checkbox" className={styles.checkbox} checked={user.isReportEmailReceiver === "true" ? true : false}
                                                        onChange={() => handleCheckbox(user.id, user.isReportEmailReceiver)}></input>
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
        </div>
    );
};

export default DistributionLists;
