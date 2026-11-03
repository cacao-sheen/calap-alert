import { IonIcon } from '@ionic/react';
import type { IncidentType } from '../types';
import { INCIDENT_INFO } from '../utils';

// Incident type badge: a white line icon on a solid square in the type's color
export default function TypeIcon({ type, large }: { type: IncidentType; large?: boolean }) {
  const info = INCIDENT_INFO[type];
  return (
    <span className={`type-chip ${large ? 'lg' : ''}`} style={{ background: info.color }} title={info.label}>
      <IonIcon icon={info.icon} />
    </span>
  );
}
