export interface CampusArea {
  id: string;
  name: string;
  prompt: string;
  welcome: string;
}

export interface CampusNextPlace {
  id: string;
  label: string;
  welcome: string;
  note: string;
}

export interface CampusCatalog {
  areas: CampusArea[];
  nextPlaces: CampusNextPlace[];
}

export interface CampusAreaView {
  id: string;
  name: string;
  prompt: string;
  welcome: string;
  open: boolean;
  noticed: boolean;
}

export interface CampusView {
  areas: CampusAreaView[];
  currentAreaId: string | null;
  prompt: string;
  welcome: string;
  allAreasOpen: boolean;
  openAreaIds: string[];
  openAreaNames: string[];
  aheadAreaNames: string[];
  parentLine: string;
  nextPlaces: CampusNextPlace[];
  nextPlaceId: string | null;
  nextPlaceWelcome: string | null;
}

export function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function parentLineFor(openAreaNames: string[]): string {
  return `Open areas: ${joinNames(openAreaNames)}.`;
}

function asText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function parseCampusCatalog(raw: unknown): CampusCatalog | null {
  if (!raw || typeof raw !== 'object') return null;
  const areasRaw = (raw as { areas?: unknown }).areas;
  const placesRaw = (raw as { nextPlaces?: unknown }).nextPlaces;
  if (!Array.isArray(areasRaw) || areasRaw.length === 0 || !Array.isArray(placesRaw)) return null;
  const areas: CampusArea[] = [];
  const seen = new Set<string>();
  for (const item of areasRaw) {
    if (!item || typeof item !== 'object') return null;
    const id = asText((item as { id?: unknown }).id, 48);
    const name = asText((item as { name?: unknown }).name, 48);
    const prompt = asText((item as { prompt?: unknown }).prompt, 140);
    const welcome = asText((item as { welcome?: unknown }).welcome, 160);
    if (!/^[a-z0-9-]{1,48}$/.test(id) || !name || !prompt || !welcome || seen.has(id)) return null;
    seen.add(id);
    areas.push({ id, name, prompt, welcome });
  }
  const nextPlaces: CampusNextPlace[] = [];
  for (const item of placesRaw) {
    if (!item || typeof item !== 'object') return null;
    const id = asText((item as { id?: unknown }).id, 48);
    const label = asText((item as { label?: unknown }).label, 60);
    const welcome = asText((item as { welcome?: unknown }).welcome, 180);
    const note = asText((item as { note?: unknown }).note, 60);
    if (!/^[a-z0-9-]{1,48}$/.test(id) || !label || !welcome || seen.has(id)) return null;
    seen.add(id);
    nextPlaces.push({ id, label, welcome, note });
  }
  return { areas, nextPlaces };
}

export function buildCampusView(
  catalog: CampusCatalog,
  savedAreaIds: Iterable<string>,
  nextPlaceId: string | null,
): CampusView {
  const saved = new Set(savedAreaIds);
  const openIds: string[] = [];
  for (let i = 0; i < catalog.areas.length; i += 1) {
    const area = catalog.areas[i];
    if (i === 0) {
      openIds.push(area.id);
      continue;
    }
    if (!saved.has(catalog.areas[i - 1].id)) break;
    openIds.push(area.id);
  }
  const open = new Set(openIds);
  const areas: CampusAreaView[] = catalog.areas.map((area) => ({
    ...area,
    open: open.has(area.id),
    noticed: saved.has(area.id),
  }));
  const current = areas.find((area) => area.open && !area.noticed) ?? null;
  const place = nextPlaceId ? catalog.nextPlaces.find((item) => item.id === nextPlaceId) ?? null : null;
  const openAreaNames = areas.filter((area) => area.open).map((area) => area.name);
  const aheadAreaNames = areas.filter((area) => !area.open).map((area) => area.name);
  return {
    areas,
    currentAreaId: current?.id ?? null,
    prompt: current?.prompt ?? '',
    welcome: current?.welcome ?? areas[areas.length - 1]?.welcome ?? '',
    allAreasOpen: openIds.length === catalog.areas.length,
    openAreaIds: openIds,
    openAreaNames,
    aheadAreaNames,
    parentLine: parentLineFor(openAreaNames),
    nextPlaces: catalog.nextPlaces,
    nextPlaceId: place?.id ?? null,
    nextPlaceWelcome: place?.welcome ?? null,
  };
}
