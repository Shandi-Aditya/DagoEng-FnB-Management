"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CreditCard, UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/contexts/NotificationContext";
import { cn } from "@/lib/utils";

const STOCK_TYPES = new Set(["CRITICAL_STOCK", "OUT_OF_STOCK"]);

function NotificationIcon({ type }: { type: string }) {
  if (STOCK_TYPES.has(type)) return <AlertTriangle className="size-4 text-destructive" />;
  if (type === "PAYMENT_RECEIVED") return <CreditCard className="size-4 text-success" />;
  return <UserCheck className="size-4 text-muted-foreground" />;
}

/** Notification center in the site header. Same data and actions as the previous hand-built dropdown. */
export function NotificationMenu() {
  const router = useRouter();
  const { filteredNotifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const visibleUnread = isMounted ? unreadCount : 0;

  const handleSelect = (id: string, actionUrl?: string) => {
    markAsRead(id);
    setOpen(false);
    if (actionUrl) router.push(actionUrl);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={visibleUnread > 0 ? `Notifikasi, ${visibleUnread} belum dibaca` : "Notifikasi"}
          />
        }
      >
        <Bell />
        {visibleUnread > 0 ? (
          <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[0.625rem] font-medium text-primary-foreground tabular-nums">
            {visibleUnread > 9 ? "9+" : visibleUnread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0 sm:w-96">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Notifikasi</span>
            {visibleUnread > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {visibleUnread} baru
              </Badge>
            ) : null}
          </div>
          {visibleUnread > 0 ? (
            <Button variant="link" size="sm" onClick={markAllAsRead}>
              Tandai semua dibaca
            </Button>
          ) : null}
        </div>

        {filteredNotifications.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">Tidak ada notifikasi</p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y">
              {filteredNotifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(notification.id, notification.actionUrl)}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-hidden",
                      !notification.isRead && "bg-muted/50",
                    )}
                  >
                    <span className="mt-0.5 shrink-0">
                      <NotificationIcon type={notification.type} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-sm", !notification.isRead && "font-medium")}>
                          {notification.title}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {notification.formattedTime}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{notification.detail}</span>
                      <span className="text-xs text-muted-foreground">{notification.outletName}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
