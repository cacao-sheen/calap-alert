import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from '@ionic/react';
import { close } from 'ionicons/icons';
import type { ReactNode } from 'react';

export default function FormModal({ isOpen, title, onClose, children }: { isOpen: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="form-modal">
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}><IonIcon slot="icon-only" icon={close} /></IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">{children}</IonContent>
    </IonModal>
  );
}
