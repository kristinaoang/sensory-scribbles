import type { CampusView } from './unlockState';

export const CAMPUS_UNLOCK_EVENT = 'sensory-scribbles:campus-unlocks';

export interface CampusUnlockHookDetail {
  source: 'sensory-scribbles';
  type: typeof CAMPUS_UNLOCK_EVENT;
  openAreaIds: string[];
  openAreaNames: string[];
  currentAreaId: string | null;
  nextPrompt: string | null;
  allAreasOpen: boolean;
  nextPlaceId: string | null;
  parentLine: string;
}

declare global {
  interface Window {
    __sensoryCampusUnlocks?: CampusUnlockHookDetail;
  }
}

export function campusUnlockDetail(view: CampusView): CampusUnlockHookDetail {
  return {
    source: 'sensory-scribbles',
    type: CAMPUS_UNLOCK_EVENT,
    openAreaIds: view.openAreaIds,
    openAreaNames: view.openAreaNames,
    currentAreaId: view.currentAreaId,
    nextPrompt: view.prompt || null,
    allAreasOpen: view.allAreasOpen,
    nextPlaceId: view.nextPlaceId,
    parentLine: view.parentLine,
  };
}

/**
 * Hook the Wellesley campus iframe can consume. The parent page also keeps the
 * same snapshot on window.__sensoryCampusUnlocks and as a window CustomEvent
 * named sensory-scribbles:campus-unlocks. Unlocking only adds areas.
 */
export function publishCampusUnlocks(view: CampusView, frame: HTMLIFrameElement | null): void {
  const detail = campusUnlockDetail(view);
  window.__sensoryCampusUnlocks = detail;
  window.dispatchEvent(new CustomEvent(CAMPUS_UNLOCK_EVENT, { detail }));
  const target = frame?.contentWindow;
  if (!target) return;
  target.postMessage(detail, 'http://127.0.0.1:3001');
}
