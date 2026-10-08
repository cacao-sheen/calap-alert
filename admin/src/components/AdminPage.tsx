import { IonButtons, IonContent, IonHeader, IonMenuButton, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import type { ReactNode } from 'react';

// Shared layout for every admin page: toolbar with title + actions, then scrolling content
export default function AdminPage({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="admin-toolbar">
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>{title}</IonTitle>
          {actions && <IonButtons slot="end" className="toolbar-actions">{actions}</IonButtons>}
        </IonToolbar>
      </IonHeader>
      <IonContent className="admin-content">
        <div className="page">{children}</div>
      </IonContent>
    </IonPage>
  );
}
