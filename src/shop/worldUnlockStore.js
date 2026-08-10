const STORAGE_KEY = 'islandstore_worlds_visited';

const DEFAULT = { island: true, space: false, underwater: false };

export function loadVisitedWorlds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        island: true,
        space: !!parsed.space,
        underwater: !!parsed.underwater,
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT };
}

export function saveVisitedWorlds(visited) {
  const next = {
    island: true,
    space: !!visited.space,
    underwater: !!visited.underwater,
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

export function isWorldUnlocked(visited, worldId) {
  if (worldId === 'island') return true;
  return !!(visited && visited[worldId]);
}

export function withWorldVisit(visited, worldId) {
  if (!worldId || worldId === 'island') return visited;
  if (visited && visited[worldId]) return visited;
  return saveVisitedWorlds({ ...(visited || {}), island: true, [worldId]: true });
}
