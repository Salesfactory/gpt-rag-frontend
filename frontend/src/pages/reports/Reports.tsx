import React, { useEffect, useState } from "react";
import {
    SearchBox,
    DetailsList,
    IColumn,
    SelectionMode,
    Text,
    Stack,
    IStackTokens,
    DefaultButton,
    mergeStyles,
    mergeStyleSets,
    FontWeights,
    IDetailsListStyles
} from "@fluentui/react";
import { getReportBlobs } from "../../api";
import { useNavigate } from "react-router-dom";

import { ArrowDownload20Regular } from "@fluentui/react-icons";

interface IReport {
    id: string;
    title: string;
    creationDate: string;
    type: string;
    downloadUrl: string;
}

const stackTokens: IStackTokens = {
    childrenGap: 20,
    padding: 20
};

const styles = mergeStyleSets({
    container: {
        maxWidth: "100%",
        backgroundColor: "#F8F8FC",
        minHeight: "100vh",

        display: "flex",
        flexDirection: "column",
        width: "100%",
        padding: "40px 100px 100px 150px",
        gap: "30px"
    },
    header: {
        marginBottom: "8px",
        display: "flex",
        flexDirection: "column"
    },
    title: {
        fontSize: "24px",
        fontWeight: FontWeights.semibold,
        color: "#333",
        letterSpacing: "0px"
    },
    subtitle: {
        fontSize: "14px",
        color: "#666",
        marginTop: "4px"
    },
    searchContainer: {
        display: "flex",
        gap: "10px",
        marginBottom: "20px"
    },
    searchBox: {
        width: "100%",
        maxWidth: "800px"
    },
    statusBadge: {
        padding: "4px 12px",
        borderRadius: "16px",
        fontSize: "12px",
        fontWeight: FontWeights.semibold,
        display: "inline-block"
    },
    complete: {
        backgroundColor: "#E7F7EE",
        color: "#1B873B"
    },
    inProcess: {
        backgroundColor: "#FFF7D1",
        color: "#D97706"
    },
    pending: {
        backgroundColor: "#FFE2E5",
        color: "#E11D48"
    },
    downloadIcon: {
        color: "#666",
        cursor: "pointer",
        ":hover": {
            color: "#333"
        }
    },
    listContainer: {
        backgroundColor: "white",
        borderRadius: "8px",
        padding: "20px",
        boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.1)"
    }
});

const detailsListStyles: Partial<IDetailsListStyles> = {
    root: {
        selectors: {
            ".ms-DetailsHeader": {
                paddingTop: "12px"
            },
            ".ms-DetailsRow": {
                borderBottom: "1px solid #f0f0f0"
            }
        }
    }
};

export default function Reports() {
    const [reports, setReports] = useState<IReport[]>([]);
    const [allReports, setAllReports] = useState<IReport[]>([]);
    const [searchText, setSearchText] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);

    const columns: IColumn[] = [
        {
            key: "id",
            name: "Report ID",
            fieldName: "id",
            minWidth: 70,
            maxWidth: 90
        },
        {
            key: "title",
            name: "Title",
            fieldName: "title",
            minWidth: 250,
            maxWidth: 300
        },
        {
            key: "type",
            name: "Type",
            fieldName: "type",
            minWidth: 100,
            maxWidth: 120
        },
        {
            key: "creationDate",
            name: "Creation Date",
            fieldName: "creationDate",
            minWidth: 200,
            maxWidth: 240,
            onRender: (item: IReport) => <span>{item.creationDate ? new Date(item.creationDate).toDateString() : null}</span>
        },
        {
            key: "download",
            name: "Download",
            fieldName: "download",
            minWidth: 70,
            maxWidth: 70,
            onRender: (item: IReport) =>
                item.downloadUrl ? (
                    <a href={item.downloadUrl} target="_blank" rel="noopener noreferrer" aria-label={`Download ${item.title}`}>
                        <ArrowDownload20Regular className={styles.downloadIcon} />
                    </a>
                ) : null
        }
    ];

    useEffect(() => {
        setLoading(true);
        const getData = async () => {
            const reports = await getReportBlobs({
                container_name: "documents",
                prefix: "Reports/Curation_Reports",
                include_metadata: "yes",
                max_results: "10"
            });

            const cleanedReports = reports.data.map((report: any, index: number) => {
                const name = report.name.split("/");
                return {
                    id: index + 1,
                    title: name[name.length - 1].split(".")[0],
                    type: name.length > 2 ? name[2] : "",
                    creationDate: report.created_on,
                    downloadUrl: report.url
                };
            });

            setReports(cleanedReports);
            setAllReports(cleanedReports);
            setLoading(false);
        };
        getData();
    }, []);

    const handleSearch = (searchText: string) => {
        if (searchText) {
            const filteredReports = allReports.filter(report => report.title.toLowerCase().includes(searchText.toLowerCase()));
            setReports(filteredReports);
        } else {
            setReports(allReports);
        }
    };

    return (
        <div className={styles.container}>
            <Stack tokens={stackTokens}>
                <div className={styles.header}>
                    <Text className={styles.title}>Report Management</Text>
                    <br />
                    <Text className={styles.subtitle}>Accessing stored reports</Text>
                </div>

                <div className={styles.searchContainer}>
                    <SearchBox
                        placeholder="Search reports..."
                        className={styles.searchBox}
                        onChange={(_, newValue) => setSearchText(newValue || "")}
                        onSearch={() => handleSearch(searchText)}
                    />
                    <DefaultButton
                        text="Search"
                        styles={{
                            root: {
                                backgroundColor: "#000",
                                color: "#fff",
                                borderRadius: "4px"
                            },
                            rootHovered: {
                                backgroundColor: "#333",
                                color: "#fff"
                            }
                        }}
                        onClick={() => handleSearch(searchText)}
                    />
                </div>

                <div className={styles.listContainer}>
                    <Text variant="large" style={{ marginBottom: "16px", display: "block" }}>
                        Stored Reports
                    </Text>
                    {loading ? (
                        <Text>Loading...</Text>
                    ) : (
                        <DetailsList items={reports} columns={columns} selectionMode={SelectionMode.none} styles={detailsListStyles} />
                    )}
                </div>
            </Stack>
        </div>
    );
}
