import React, { useState, useEffect } from "react";
import {
    Stack,
    Text,
    DetailsList,
    DetailsListLayoutMode,
    IColumn,
    SelectionMode,
    Dropdown,
    IDropdownOption,
    TextField,
    PrimaryButton,
    DefaultButton,
    Spinner,
    SpinnerSize,
    useTheme,
    Icon
} from "@fluentui/react";
import { getUserActivityLogs, getPlatformOrganizations } from "../../../api/api";
import { useAppContext } from "../../../providers/AppProviders";
import styles from "./UserActivity.module.css";

// Define interfaces locally since we are removing mock data dependencies
interface UserActivity {
    user_name: string;
    first_login_date: number; // unix timestamp
    session_count: number;
    conversation_count: number;
    message_count: number;
}

interface Organization {
    id: string;
    name: string;
}

export const UserActivityPage: React.FC = () => {
    const { user } = useAppContext();
    const theme = useTheme();
    const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>("");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadOrganizations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedOrganizationId) {
            loadUserActivity();
        } else {
            setUserActivities([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedOrganizationId, startDate, endDate]);

    const loadOrganizations = async () => {
        try {
            const response = await getPlatformOrganizations({ user });
            setOrganizations(response?.data || []);
        } catch (error) {
            console.error("Failed to load organizations", error);
        }
    };

    const loadUserActivity = async () => {
        if (!selectedOrganizationId) return;

        setIsLoading(true);
        try {
            const filters: any = {};
            if (selectedOrganizationId) filters.organizationId = selectedOrganizationId;
            if (startDate) filters.startDate = startDate;
            if (endDate) filters.endDate = endDate;

            const response = await getUserActivityLogs({ ...filters, user });
            setUserActivities(response?.data || []);
        } catch (error) {
            console.error("Failed to load user activity", error);
            setUserActivities([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearFilters = () => {
        setSelectedOrganizationId("");
        setStartDate("");
        setEndDate("");
    };

    const formatDate = (dateValue: number | string) => {
        if (!dateValue) return "N/A";
        const date = typeof dateValue === "number" ? new Date(dateValue * 1000) : new Date(dateValue);

        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    };

    const organizationOptions: IDropdownOption[] = (organizations || []).map(org => ({ key: org.id, text: org.name }));

    const columns: IColumn[] = [
        {
            key: "user_name",
            name: "User Name",
            fieldName: "user_name",
            minWidth: 200,
            maxWidth: 300,
            isResizable: true,
            onRender: (item: UserActivity) => {
                const name = item.user_name || "Unknown";
                return (
                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                backgroundColor: theme.palette.themePrimary,
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 600,
                                fontSize: 14
                            }}
                        >
                            {name.charAt(0).toUpperCase()}
                        </div>
                        <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                            {name}
                        </Text>
                    </Stack>
                );
            }
        },
        {
            key: "first_login_date",
            name: "First Login Date",
            fieldName: "first_login_date",
            minWidth: 150,
            maxWidth: 200,
            isResizable: true,
            onRender: (item: UserActivity) => (
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
                    <Icon iconName="Calendar" styles={{ root: { color: theme.palette.neutralSecondary } }} />
                    <Text variant="small">{formatDate(item.first_login_date)}</Text>
                </Stack>
            )
        },
        {
            key: "session_count",
            name: "Sessions",
            fieldName: "session_count",
            minWidth: 100,
            maxWidth: 150,
            isResizable: true,
            onRender: (item: UserActivity) => (
                <div
                    style={{
                        display: "inline-block",
                        padding: "4px 12px",
                        borderRadius: 12,
                        backgroundColor: "#dff6dd",
                        color: "#107c10",
                        fontWeight: 600,
                        fontSize: 12
                    }}
                >
                    {item.session_count}
                </div>
            )
        },
        {
            key: "conversation_count",
            name: "Conversations",
            fieldName: "conversation_count",
            minWidth: 120,
            maxWidth: 150,
            isResizable: true,
            onRender: (item: UserActivity) => (
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
                    <Icon iconName="Message" styles={{ root: { color: theme.palette.neutralSecondary } }} />
                    <div
                        style={{
                            display: "inline-block",
                            padding: "4px 12px",
                            borderRadius: 12,
                            backgroundColor: "#f3e5f5",
                            color: "#6a1b9a",
                            fontWeight: 600,
                            fontSize: 12
                        }}
                    >
                        {item.conversation_count}
                    </div>
                </Stack>
            )
        },
        {
            key: "message_count",
            name: "Messages",
            fieldName: "message_count",
            minWidth: 100,
            maxWidth: 150,
            isResizable: true,
            onRender: (item: UserActivity) => (
                <div
                    style={{
                        display: "inline-block",
                        padding: "4px 12px",
                        borderRadius: 12,
                        backgroundColor: "#e3f2fd",
                        color: "#0078d4",
                        fontWeight: 600,
                        fontSize: 12
                    }}
                >
                    {item.message_count}
                </div>
            )
        }
    ];

    return (
        <div className={styles.container}>
            <Stack tokens={{ childrenGap: 24 }}>
                {/* Header */}
                <Stack tokens={{ childrenGap: 8 }}>
                    <Text variant="xxLarge" styles={{ root: { fontWeight: 600 } }}>
                        User Activity
                    </Text>
                    <Text variant="medium" styles={{ root: { color: theme.palette.neutralSecondary } }}>
                        Track user sessions and message activity
                    </Text>
                </Stack>

                {/* Filters Card */}
                <Stack
                    styles={{
                        root: {
                            padding: 24,
                            backgroundColor: "white",
                            borderRadius: 8,
                            boxShadow: "0 1.6px 3.6px 0 rgba(0,0,0,0.132), 0 0.3px 0.9px 0 rgba(0,0,0,0.108)"
                        }
                    }}
                    tokens={{ childrenGap: 16 }}
                >
                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                        <Icon iconName="Filter" styles={{ root: { fontSize: 18, color: theme.palette.neutralSecondary } }} />
                        <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                            Filters
                        </Text>
                    </Stack>

                    <Stack horizontal tokens={{ childrenGap: 12 }} wrap>
                        <Stack.Item grow={1} styles={{ root: { minWidth: 200 } }}>
                            <Dropdown
                                placeholder="Select organization"
                                label="Organization"
                                options={organizationOptions}
                                selectedKey={selectedOrganizationId}
                                onChange={(_, option) => setSelectedOrganizationId((option?.key as string) || "")}
                            />
                        </Stack.Item>

                        <Stack.Item grow={1} styles={{ root: { minWidth: 150 } }}>
                            <TextField label="Start Date" type="date" value={startDate} onChange={(_, newValue) => setStartDate(newValue || "")} />
                        </Stack.Item>

                        <Stack.Item grow={1} styles={{ root: { minWidth: 150 } }}>
                            <TextField label="End Date" type="date" value={endDate} onChange={(_, newValue) => setEndDate(newValue || "")} />
                        </Stack.Item>

                        <Stack.Item align="end">
                            <Stack horizontal tokens={{ childrenGap: 8 }}>
                                <PrimaryButton text="Refresh" iconProps={{ iconName: "Refresh" }} onClick={loadUserActivity} />
                                <DefaultButton text="Clear" onClick={handleClearFilters} />
                            </Stack>
                        </Stack.Item>
                    </Stack>
                </Stack>

                {/* Data Table Card */}
                <Stack
                    styles={{
                        root: {
                            padding: 24,
                            backgroundColor: "white",
                            borderRadius: 8,
                            boxShadow: "0 1.6px 3.6px 0 rgba(0,0,0,0.132), 0 0.3px 0.9px 0 rgba(0,0,0,0.108)"
                        }
                    }}
                >
                    {isLoading ? (
                        <Stack horizontalAlign="center" verticalAlign="center" styles={{ root: { padding: "60px 0" } }}>
                            <Spinner size={SpinnerSize.large} label="Loading user activity..." />
                        </Stack>
                    ) : userActivities.length === 0 ? (
                        <Stack horizontalAlign="center" verticalAlign="center" tokens={{ childrenGap: 12 }} styles={{ root: { padding: "60px 0" } }}>
                            <Icon iconName="People" styles={{ root: { fontSize: 48, color: theme.palette.neutralTertiary } }} />
                            <Text variant="large" styles={{ root: { color: theme.palette.neutralSecondary } }}>
                                No user activity found
                            </Text>
                            <Text variant="small" styles={{ root: { color: theme.palette.neutralTertiary } }}>
                                Try adjusting your filters
                            </Text>
                        </Stack>
                    ) : (
                        <DetailsList
                            items={userActivities}
                            columns={columns}
                            layoutMode={DetailsListLayoutMode.justified}
                            selectionMode={SelectionMode.none}
                            isHeaderVisible={true}
                        />
                    )}
                </Stack>
            </Stack>
        </div>
    );
};
