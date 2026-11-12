import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Alert, HouseholdInvite } from './types';

// Remembers the newest alert the resident has seen, so the bell can show a dot for new ones
export const SEEN_KEY = 'lastSeenAlertId';

type Requests = { received: HouseholdInvite[]; sent: HouseholdInvite[] };
type NotifValue = {
  newAlert: boolean;
  requests: Requests;
  refresh: () => void;
};

const NotifContext = createContext<NotifValue>({ newAlert: false, requests: { received: [], sent: [] }, refresh: () => {} });

// Shared by every page's bell, the Notifications page and the Family pages, so they all agree.
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [newAlert, setNewAlert] = useState(false);
  const [requests, setRequests] = useState<Requests>({ received: [], sent: [] });
  const barangayId = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      barangayId.current ??= (await api<{ barangayId: number }>('/auth/me')).barangayId;
      const [alerts, inv] = await Promise.all([
        api<Alert[]>(`/alerts?barangayId=${barangayId.current}&limit=1`),
        api<Requests>('/household/invites'),
      ]);
      setNewAlert(!!alerts[0] && alerts[0].id > Number(localStorage.getItem(SEEN_KEY) ?? 0));
      setRequests(inv);
    } catch {
      // The bell is extra; a failed check just tries again next minute
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  return <NotifContext.Provider value={{ newAlert, requests, refresh }}>{children}</NotifContext.Provider>;
}

export const useNotifications = () => useContext(NotifContext);
