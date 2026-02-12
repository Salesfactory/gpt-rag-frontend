import React, { useRef } from "react";
import styles from "./Notifications.module.css"
import { Bell, Trash } from "lucide-react";

const Notifications: React.FC = () => {

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
const items: any = [
    {
    "id": "54e4f872-c8ae-44e9-bcd3-debf800df5bb",
    "title": "Test123",
    "message": "test",
    "enabled": false,
    "createdAt": "2026-02-09T23:42:31.315592+00:00",
    "updatedAt": "2026-02-11T18:14:20.855399+00:00",
    "_rid": "efxAANtfv5oCAAAAAAAAAA==",
    "_self": "dbs/efxAAA==/colls/efxAANtfv5o=/docs/efxAANtfv5oCAAAAAAAAAA==/",
    "_etag": "\"01018f84-0000-0100-0000-698cc6fc0000\"",
    "_attachments": "attachments/",
    "acknowledgedBy": [],
    "_ts": 1770833660
},     {
    "id": "54e4f872-c8ae-44e9-bcd3-debf800dd5bb",
    "title": "Test123",
    "message": "test",
    "enabled": false,
    "createdAt": "2026-02-09T23:42:31.315592+00:00",
    "updatedAt": "2026-02-11T18:14:20.855399+00:00",
    "_rid": "efxAANtfv5oCAAAAAAAAAA==",
    "_self": "dbs/efxAAA==/colls/efxAANtfv5o=/docs/efxAANtfv5oCAAAAAAAAAA==/",
    "_etag": "\"01018f84-0000-0100-0000-698cc6fc0000\"",
    "_attachments": "attachments/",
    "acknowledgedBy": [],
    "_ts": 1770833660
}
];

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
                <ul className={styles.tableContainer} style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    <li className={styles.headerRow}>
                        <Bell size={20} />
                        Notifications (3 Unread)
                    </li>
                    {items.map((item: any, index: number) => (
                        <li
                            key={item.id}
                            className={styles.notificationRow}
                            style={{ backgroundColor: index % 2 === 0 ? "#f8f8f7" : "#f6f6f7" }}
                        >
                            <div className={styles.notificationRowDiv}>
                                <div className={styles.notificationInfo}>
                                    <div className={styles.notificationTitle}>
                                        <span className={styles.greenCircle}></span>
                                        <p className={styles.title}>{item.title}</p>
                                    </div>
                                    <p>{item.message}</p>
                                </div>
                            </div>
                            <div>
                                    {formatDate(item.createdAt)}
                                <div className={styles.notificationActions}>
                                    <button>
                                        <Trash size={20} />
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default Notifications;
