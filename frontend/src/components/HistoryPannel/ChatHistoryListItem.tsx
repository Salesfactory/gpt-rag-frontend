import styles from "./ChatHistoryPannel.module.css";
import { getChatHistory } from "../../api";
import { useEffect, useState } from "react";
import { useAppContext } from "../../providers/AppProviders";
import trash from "../../assets/trash.png"
import pencil from "../../assets/pencil.png"

export const ChatHistoryPanelList = () => {

  const [hoveredItemIndex, setHoveredItemIndex] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const {dataHistory, setDataHistory} = useAppContext()


  const handleMouseEnter = (index: string) => {
    setHoveredItemIndex(index);
  };

  const handleMouseLeave = () => {
    setHoveredItemIndex(null);
  };


  const fetchData = async () => {
        try {
            const data = await getChatHistory();
            if(data.length > 0){
              setDataHistory(data)
              setIsLoading(false);
            }else{
              setIsLoading(false);
              setErrorMessage("There are not conversation history yet.")
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            setIsLoading(false);
            setErrorMessage(`Was an error fetching data: ${error}`)
        }
    };

  useEffect(() => {
    fetchData();
  }, []);

  const months = [
    "January", "February", "March", "April",
    "May", "June", "July", "August",
    "September", "October", "November", "December"
  ];

  const sortedDataByMonth = dataHistory.sort((a, b) => {
      const monthA = new Date(a.start_date).getMonth();
      const monthB = new Date(b.start_date).getMonth();
      return monthA - monthB;
  });

  const sortedDataListByMonth = months.map(month => {
      const monthData = sortedDataByMonth.filter(item => {
          return new Date(item.start_date).getMonth() === months.indexOf(month);
      });
      return { month, data: monthData };
  });


  return (
      <div className={styles.listContainer}>
        {isLoading && (
          <div className={styles.loaderContainer}>
            <div className={styles.customLoader}></div>
          </div>
        )}
        {errorMessage !== null ? (
          <p style={{ textAlign: "center", fontWeight: 400, fontStyle: "italic" }}>{errorMessage}</p>
        ) : (
          <>
            {sortedDataListByMonth.map(({ month, data }, monthIndex) => (
              <div key={monthIndex}>
                {data.length > 0 && (
                  <>
                    <h3>{month}</h3>
                    {data.map((conversation, index) => (
                      <div
                        key={conversation.id}
                        className={styles.conversationContainer}
                        onMouseEnter={() => handleMouseEnter(`${monthIndex}-${index}`)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <button className={styles.buttonConversation}>
                          {conversation.content}
                        </button>
                        {hoveredItemIndex === `${monthIndex}-${index}` && (
                          <div className={styles.actionsButtons}>
                            <img className={styles.actionButton} src={trash} alt="Destroy" />
                            <img className={styles.actionButton} src={pencil} alt="Edit" />
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    );


}