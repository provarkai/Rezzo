'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRezzoStore, apiGet, apiPost } from '@/store/rezzo-store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Bell, Loader2 } from 'lucide-react'

interface NotificationItem {
  id: string
  caseId?: string | null
  type: string
  readAt?: string | null
  createdAt: string
  case?: { caseNumber?: string } | null
  payloadJson?: { title?: string; body?: string } | null
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

interface NotificationBellProps {
  /** Where to navigate when a notification with a caseId is selected.
   *  Defaults to the customer case workspace; pass setProSelectedCaseId
   *  (or similar) for other roles. */
  onSelectCase?: (caseId: string) => void
}

export function NotificationBell({ onSelectCase }: NotificationBellProps = {}) {
  const setSelectedCaseId = useRezzoStore((s) => s.setSelectedCaseId)
  const goToCase = onSelectCase || setSelectedCaseId
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiGet<{ notifications: NotificationItem[]; unreadCount: number }>(
        '/notifications?limit=20'
      )
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {
      // Silent — the bell just shows nothing new rather than an error state
    } finally {
      setLoading(false)
    }
  }, [])

  // Light polling so the unread count stays current without a websocket.
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const handleOpen = () => {
    setOpen(true)
    fetchNotifications()
  }

  const handleSelect = async (n: NotificationItem) => {
    if (!n.readAt) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
      setUnreadCount((c) => Math.max(0, c - 1))
      apiPost(`/notifications/${n.id}/read`).catch(() => {})
    }
    if (n.caseId) {
      setOpen(false)
      goToCase(n.caseId)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative p-1.5 rounded-lg hover:bg-muted transition-colors"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <Bell className="size-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rezzo-danger text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                You&apos;re all caught up.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleSelect(n)}
                    className={`text-left p-3 rounded-lg transition-colors ${
                      n.readAt ? 'bg-transparent hover:bg-muted/60' : 'bg-rezzo-green/5 hover:bg-rezzo-green/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-rezzo-navy leading-snug">
                        {n.payloadJson?.title || 'Update on your case'}
                      </p>
                      {!n.readAt && (
                        <span className="w-2 h-2 rounded-full bg-rezzo-green shrink-0 mt-1.5" />
                      )}
                    </div>
                    {n.payloadJson?.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {n.payloadJson.body}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                      {n.case?.caseNumber && <span>{n.case.caseNumber}</span>}
                      <span>{timeAgo(n.createdAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
