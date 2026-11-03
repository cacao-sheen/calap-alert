import { IonIcon } from '@ionic/react';

// Friendly "nothing here" message so empty lists don't look broken
export default function Empty({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <IonIcon icon={icon} />
      <b>{title}</b>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  );
}
