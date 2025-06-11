import styles from "./UserChatMessage.module.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useAppContext } from "../../providers/AppProviders";
interface Props {
    message: string;
}

export const UserChatMessage = ({ message }: Props) => {
    const { settings } = useAppContext();

    return (
        <div className={styles.container}>
            <div
                className={styles.message}
                style={{
                    fontFamily: settings.font_family?.trim() || "Arial",
                    fontSize: settings.font_size ? `${settings.font_size}px` : "16px"
                }}
            >
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {message}
                </ReactMarkdown>
            </div>
        </div>
    );
};
