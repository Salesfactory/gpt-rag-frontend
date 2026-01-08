// Mock User Activity Service for Platform Admin Portal

import {
  mockDataStore,
  STORAGE_KEYS,
  generateId,
  simulateDelay
} from './mockData';

export interface UserActivity {
  id: string;
  organization_id: string | null;
  user_name: string;
  first_login_date: string;
  session_count: number;
  conversation_count: number;
  message_count: number;
  last_activity_date: string;
  created_at: string;
  updated_at: string;
}

export interface UserActivityFilters {
  organizationId?: string;
  startDate?: string;
  endDate?: string;
}

// Initial mock data
const initialUserActivities: UserActivity[] = [
  {
    id: '1',
    organization_id: '1',
    user_name: 'Alice Johnson',
    first_login_date: '2024-01-15T08:00:00Z',
    session_count: 45,
    conversation_count: 32,
    message_count: 256,
    last_activity_date: '2024-03-20T16:30:00Z',
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-03-20T16:30:00Z'
  },
  {
    id: '2',
    organization_id: '1',
    user_name: 'Bob Smith',
    first_login_date: '2024-01-20T09:15:00Z',
    session_count: 38,
    conversation_count: 28,
    message_count: 189,
    last_activity_date: '2024-03-19T14:20:00Z',
    created_at: '2024-01-20T09:15:00Z',
    updated_at: '2024-03-19T14:20:00Z'
  },
  {
    id: '3',
    organization_id: '2',
    user_name: 'Carol White',
    first_login_date: '2024-02-01T10:30:00Z',
    session_count: 52,
    conversation_count: 41,
    message_count: 312,
    last_activity_date: '2024-03-21T11:45:00Z',
    created_at: '2024-02-01T10:30:00Z',
    updated_at: '2024-03-21T11:45:00Z'
  },
  {
    id: '4',
    organization_id: '2',
    user_name: 'David Brown',
    first_login_date: '2024-02-05T11:00:00Z',
    session_count: 29,
    conversation_count: 22,
    message_count: 145,
    last_activity_date: '2024-03-18T09:30:00Z',
    created_at: '2024-02-05T11:00:00Z',
    updated_at: '2024-03-18T09:30:00Z'
  },
  {
    id: '5',
    organization_id: '3',
    user_name: 'Emma Davis',
    first_login_date: '2024-02-10T13:45:00Z',
    session_count: 61,
    conversation_count: 48,
    message_count: 421,
    last_activity_date: '2024-03-21T17:15:00Z',
    created_at: '2024-02-10T13:45:00Z',
    updated_at: '2024-03-21T17:15:00Z'
  },
  {
    id: '6',
    organization_id: '3',
    user_name: 'Frank Miller',
    first_login_date: '2024-02-15T08:20:00Z',
    session_count: 34,
    conversation_count: 26,
    message_count: 178,
    last_activity_date: '2024-03-20T13:50:00Z',
    created_at: '2024-02-15T08:20:00Z',
    updated_at: '2024-03-20T13:50:00Z'
  },
  {
    id: '7',
    organization_id: '1',
    user_name: 'Grace Lee',
    first_login_date: '2024-02-20T14:10:00Z',
    session_count: 42,
    conversation_count: 35,
    message_count: 267,
    last_activity_date: '2024-03-21T10:25:00Z',
    created_at: '2024-02-20T14:10:00Z',
    updated_at: '2024-03-21T10:25:00Z'
  },
  {
    id: '8',
    organization_id: '2',
    user_name: 'Henry Wilson',
    first_login_date: '2024-03-01T09:30:00Z',
    session_count: 18,
    conversation_count: 14,
    message_count: 92,
    last_activity_date: '2024-03-21T15:40:00Z',
    created_at: '2024-03-01T09:30:00Z',
    updated_at: '2024-03-21T15:40:00Z'
  }
];

// Get user activities from localStorage or use initial data
function getUserActivitiesFromStorage(): UserActivity[] {
  return mockDataStore.loadFromStorage(
    STORAGE_KEYS.USER_ACTIVITIES,
    initialUserActivities
  );
}

// Save user activities to localStorage
function saveUserActivitiesToStorage(activities: UserActivity[]): void {
  mockDataStore.saveToStorage(STORAGE_KEYS.USER_ACTIVITIES, activities);
}

export async function getUserActivity(filters: UserActivityFilters = {}): Promise<UserActivity[]> {
  await simulateDelay();

  let activities = getUserActivitiesFromStorage();

  // Apply filters
  if (filters.organizationId) {
    activities = activities.filter(a => a.organization_id === filters.organizationId);
  }

  if (filters.startDate) {
    const startDate = new Date(filters.startDate);
    activities = activities.filter(a => new Date(a.first_login_date) >= startDate);
  }

  if (filters.endDate) {
    const endDate = new Date(filters.endDate);
    activities = activities.filter(a => new Date(a.first_login_date) <= endDate);
  }

  // Sort by first_login_date descending
  activities.sort((a, b) =>
    new Date(b.first_login_date).getTime() - new Date(a.first_login_date).getTime()
  );

  return activities;
}

export async function createUserActivity(
  activity: Omit<UserActivity, 'id' | 'created_at' | 'updated_at'>
): Promise<UserActivity> {
  await simulateDelay();

  const now = new Date().toISOString();
  const newActivity: UserActivity = {
    ...activity,
    id: generateId(),
    created_at: now,
    updated_at: now
  };

  const activities = getUserActivitiesFromStorage();
  activities.push(newActivity);
  saveUserActivitiesToStorage(activities);

  return newActivity;
}

export async function updateUserActivity(
  id: string,
  updates: Partial<UserActivity>
): Promise<UserActivity> {
  await simulateDelay();

  const activities = getUserActivitiesFromStorage();
  const index = activities.findIndex(a => a.id === id);

  if (index === -1) {
    throw new Error(`User activity with id ${id} not found`);
  }

  const updatedActivity: UserActivity = {
    ...activities[index],
    ...updates,
    updated_at: new Date().toISOString()
  };

  activities[index] = updatedActivity;
  saveUserActivitiesToStorage(activities);

  return updatedActivity;
}

export async function deleteUserActivity(id: string): Promise<void> {
  await simulateDelay();

  const activities = getUserActivitiesFromStorage();
  const filteredActivities = activities.filter(a => a.id !== id);

  if (filteredActivities.length === activities.length) {
    throw new Error(`User activity with id ${id} not found`);
  }

  saveUserActivitiesToStorage(filteredActivities);
}

// Reset to initial data (useful for testing)
export async function resetUserActivities(): Promise<void> {
  await simulateDelay();
  saveUserActivitiesToStorage(initialUserActivities);
}
