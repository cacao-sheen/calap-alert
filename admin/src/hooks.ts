import { useIonViewWillEnter } from '@ionic/react';
import { useEffect, useRef } from 'react';

// Runs `load` when the page first opens AND every time the user comes back to it.
// (Ionic's ionViewWillEnter alone does not fire when the app is opened directly on a page.)
export function usePageLoad(load: () => void) {
  const latest = useRef(load);
  latest.current = load;
  useEffect(() => {
    latest.current();
  }, []);
  useIonViewWillEnter(() => latest.current());
}
