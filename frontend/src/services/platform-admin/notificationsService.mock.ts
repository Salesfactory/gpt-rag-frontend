// Mock Notifications Service for Platform Admin Portal

import {
  Notification,
  initialNotifications,
  mockDataStore,
  STORAGE_KEYS,
  simulateDelay,
  generateId
} from './mockData';

export interface CreateNotificationInput {
  title: string;
  message: string;
  is_enabled: boolean;
}

// Get notifications from localStorage or use initial data
function getNotificationsFromStorage(): Notification[] {
  return mockDataStore.loadFromStorage(
    STORAGE_KEYS.NOTIFICATIONS,
    initialNotifications
  );
}

// Save notifications to localStorage
function saveNotificationsToStorage(notifications: Notification[]): void {
  mockDataStore.saveToStorage(STORAGE_KEYS.NOTIFICATIONS, notifications);
}

export const notificationsService = {
  // Get all notifications
  async getAll(): Promise<Notification[]> {
    await simulateDelay();
    const notifications = getNotificationsFromStorage();
    return [...notifications].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  // Create a new notification
  async create(input: CreateNotificationInput): Promise<Notification> {
    await simulateDelay();
    const notifications = getNotificationsFromStorage();
    const now = new Date().toISOString();

    const newNotification: Notification = {
      id: generateId(),
      title: input.title,
      message: input.message,
      is_enabled: input.is_enabled,
      created_at: now,
      updated_at: now,
    };

    // If enabling this notification, disable all others
    if (input.is_enabled) {
      notifications.forEach(n => {
        n.is_enabled = false;
        n.updated_at = now;
      });
    }

    notifications.push(newNotification);
    saveNotificationsToStorage(notifications);
    return newNotification;
  },

  // Toggle enable/disable for a notification
  async toggleEnable(id: string): Promise<Notification> {
    await simulateDelay();
    const notifications = getNotificationsFromStorage();
    const notification = notifications.find(n => n.id === id);

    if (!notification) {
      throw new Error(`Notification with id ${id} not found`);
    }

    const now = new Date().toISOString();

    if (notification.is_enabled) {
      // Disable it
      notification.is_enabled = false;
      notification.updated_at = now;
    } else {
      // Enable it and disable all others
      notifications.forEach(n => {
        n.is_enabled = n.id === id;
        n.updated_at = now;
      });
    }

    saveNotificationsToStorage(notifications);
    return notification;
  },

  // Delete a notification
  async delete(id: string): Promise<void> {
    await simulateDelay();
    const notifications = getNotificationsFromStorage();
    const filtered = notifications.filter(n => n.id !== id);

    if (filtered.length === notifications.length) {
      throw new Error(`Notification with id ${id} not found`);
    }

    saveNotificationsToStorage(filtered);
  },
};
