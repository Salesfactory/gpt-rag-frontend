import React, { useEffect, useRef, useState } from "react";
import styles from "./Notifications.module.css"
import { Bell, Trash2 } from "lucide-react";
import { getUserNotifications } from "../../api";
import { useAppContext } from "../../providers/AppProviders";


type Notification = {
    id: string;
    title: string;
    message: string;
    createdAt: string;
    isUnread: boolean;
}

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

useEffect(() => {
   const getNotifications = async () => {
    const response: any = await getUserNotifications({ user: user });
    setNotifications(response.data);
   } 
   getNotifications();
}, []);

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
};

    return (
        <div className={styles.page_container}>
            <div className={styles.tableScroll} ref={tableScrollRef} onWheel={handleTableWheel}>
                <ul className={styles.tableContainer}>
                    <li className={styles.headerRow}>
                        <Bell size={20} />
                        Notifications {notifications.length > 0 ? `(${notifications.filter((item) => !item.isUnread).length} unread)` : ""}
                    </li>
                    { notifications.length > 0 ? notifications.map((item) => {
                        const classNames = [styles.notificationRow];

                        if (item.isUnread) {
                            classNames.push(styles.notificationRowUnread);
                        }

                        return (
                        <li
                            key={item.id}
                            className={classNames.join(" ")}
                        >
                            <div className={styles.indicator}>
                                {item.isUnread ? <span className={styles.greenCircle} /> : null}
                            </div>
                            <div className={styles.notificationContent}>
                                <div className={styles.notificationHeadline}>
                                    <h3 className={styles.notificationTitle}>{item.title}</h3>
                                    <span className={styles.date}>{formatDate(item.createdAt)}</span>
                                </div>
                                <p className={styles.message}>{item.message}</p>
                            </div>
                            <div className={styles.notificationActions}>
                                <button className={styles.iconButton} aria-label={`Delete notification ${item.title}`}>
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
