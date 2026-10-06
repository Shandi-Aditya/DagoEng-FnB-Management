"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { SystemNotification, NotificationType } from "@/types/notification";
import { useOutlet } from "./OutletContext";

const INITIAL_NOTIFICATIONS: SystemNotification[] = [];

interface NotificationContextType {
  notifications: SystemNotification[];
  filteredNotifications: SystemNotification[];
  unreadCount: number;
  addNotification: (
    notif: Omit<SystemNotification, "id" | "timestamp" | "formattedTime" | "isRead">
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const STORAGE_KEY_NOTIFS = "dagoeng_notifications_v3";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { activeOutletId, isAllOutlets } = useOutlet();
  const [notifications, setNotifications] = useState<SystemNotification[]>(INITIAL_NOTIFICATIONS);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_NOTIFS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotifications(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load notifications", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(notifications));
    } catch (e) {
      console.error("Failed to save notifications", e);
    }
  }, [notifications, isInitialized]);

  const filteredNotifications = notifications.filter((n) => {
    if (isAllOutlets) return true;
    return n.outletId === activeOutletId || n.outletId === "GLOBAL" || !n.outletId;
  });

  const unreadCount = filteredNotifications.filter((n) => !n.isRead).length;

  const addNotification = (
    notifData: Omit<SystemNotification, "id" | "timestamp" | "formattedTime" | "isRead">
  ) => {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const newNotif: SystemNotification = {
      id: `ntf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString(),
      formattedTime,
      isRead: false,
      ...notifData,
    };

    setNotifications((prev) => [newNotif, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true }))
    );
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        filteredNotifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
