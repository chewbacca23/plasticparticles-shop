const STORAGE_KEY = 'islandstore_character';

export const HATS = [
  { id: 'none',   label: 'No hat',  emoji: '—' },
  { id: 'cap',    label: 'Cap',     emoji: '🧢' },
  { id: 'crown',  label: 'Crown',   emoji: '👑' },
  { id: 'party',  label: 'Party',   emoji: '🎉' },
  { id: 'tophat', label: 'Top Hat', emoji: '🎩', reward: 'hat_tophat' },
];

export const COLORS = [
  '#7F77DD', '#FF6EB4', '#1D9E75', '#FFD700',
  '#D85A30', '#4db8d9', '#e87850', '#ffffff',
];

export function loadCharacter() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export function saveCharacter(choice) {
  const next = {
    id: choice.id === 'cat' ? 'cat' : 'milo',
    name: (choice.name || (choice.id === 'cat' ? 'Cat' : 'Milo')).slice(0, 12),
    color: choice.color || (choice.id === 'cat' ? '#FF6EB4' : '#7F77DD'),
    hat: choice.hat || 'none',
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}
