import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Notifications.module.css"
import { Bell, Trash2 } from "lucide-react";
import { acknowledgeNotification, getGlobalNotifications, getUserNotifications, hideNotification } from "../../api";
import { useAppContext } from "../../providers/AppProviders";


type Notification = {
    id: string;
    title: string;
    message: string;
    createdAt?: string;
    created_at?: string;
    updatedAt?: string;
    updated_at?: string;
    acknowledgedBy: string[];
}

const resolveTimestamp = (notification: Notification): string => {
    return (
        notification.createdAt ||
        notification.created_at ||
        notification.updatedAt ||
        notification.updated_at ||
        new Date().toISOString()
    );
};

const Notifications: React.FC = () => {
    const { user } = useAppContext();
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const tableScrollRef = useRef<HTMLDivElement>(null);
    const handleTableWheel = (event: React.WheelEvent<HTMLDivElement>) => {
  const node = tableScrollRef.current;
  if (!node) return;
 
  const atTop = node.scrollTop <= 0 && event.deltaY < 0;
  const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight && event.deltaY > 0;
  
  if (!atTop && !atBottom) {
    event.preventDefault();
    event.stopPropagation();
  }

  
};

 const getNotifications = useCallback(async () => {
    if (!user?.id) {
        setNotifications([]);
        return;
    }

    try {
        const response: any = await getGlobalNotifications(user);
        const notifications = response.data.sort(
            (a: Notification, b: Notification) =>
                new Date(resolveTimestamp(b)).getTime() - new Date(resolveTimestamp(a)).getTime()
        );
        setNotifications(notifications);
    } catch (error) {
        console.error("Failed to load notifications", error);
    }
   }, [user]) 


const formatDate = (notification: Notification) => {
    const date = new Date(resolveTimestamp(notification));
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
};

const acknowledgedByUser = (notification: Notification) => {
    return notification.acknowledgedBy.includes(user?.id || "");
}

const handleNotificationClick = async (notificationId: string) => {
       try {
        const notification = notifications.find((notification) => notification.id === notificationId);
        if (!notification) return;
        if (!user) return;
        if (!notification.acknowledgedBy.includes(user.id)) {
            notification.acknowledgedBy.push(user.id);
            await acknowledgeNotification({ user: user, notificationId: notificationId });
            await getNotifications();
        }
       } catch (error) {
           console.log(error);
       }
}

const handleDeleteNotification = async (notificationId: string) => {
    try {
        const response = await hideNotification({user,notificationId})
        if (response) {
            setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId));
            await getNotifications()
        }
    } catch (error) {
        console.log(error)
    }
}

useEffect(() => {
   getNotifications();
}, [getNotifications]);


    return (
        <div className={styles.page_container}>
            <div className={styles.tableScroll} ref={tableScrollRef} onWheel={handleTableWheel}>
                <ul className={styles.tableContainer}>
                    <li className={styles.headerRow}>
                        <Bell size={20} />
                        Notifications {notifications.filter((item) => !item.acknowledgedBy.includes(user?.id || "")).length > 0 ? `(${notifications.filter((item) => !item.acknowledgedBy.includes(user?.id || "")).length} unread)` : ""}
                    </li>
                    { notifications.length > 0 ? notifications.map((item) => {
                        const classNames = [styles.notificationRow];

                        if (!acknowledgedByUser(item)) {
                            classNames.push(styles.notificationRowUnread);
                        }

                        return (
                        <li onClick={() => {
                            handleNotificationClick(item.id);
                        }}
                            key={item.id}
                            className={classNames.join(" ")}
                        >
                            <div className={styles.indicator}>
                                {acknowledgedByUser(item) ? null : <span className={styles.greenCircle} />}
                            </div>
                            <div className={styles.notificationContent}>
                                <div className={styles.notificationHeadline}>
                                    <h3 className={acknowledgedByUser(item) ? styles.notificationTitle : styles.notificationTitleUnread}>{item.title}</h3>
                                    <span className={styles.date}>{formatDate(item)}</span>
                                </div>
                                <p className={styles.message}>{item.message}</p>
                            </div>
                            <div className={styles.notificationActions}>
                                <button className={styles.iconButton} aria-label={`Delete notification ${item.title}`} onClick={() => {
                                    handleDeleteNotification(item.id)
                                }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </li>
                    )}) : (
                        <li className={styles.noNotificationsRow}>
                            <div className={styles.noNotificationsContent}>
                                <Bell size={50} color="#B6B6BA" />
                                <p className={styles.noNotificationsTitle}>No Notifications</p>
                                <p className={styles.noNotificationsDescription}>Youre all caught up! Check back later.</p>
                            </div>
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default Notifications;
