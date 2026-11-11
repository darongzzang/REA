export type SavedTranslation = {
  id: string;
  source: string;
  target: string;
  input: string;
  output: string;
  createdAt: number;
};

const HISTORY_KEY = 'papago-study-history-v1';
const FAVORITES_KEY = 'papago-study-favorites-v1';

function read(key: string): SavedTranslation[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((item) => item && typeof item.input === 'string' && typeof item.output === 'string' && typeof item.id === 'string') : [];
  } catch {
    return [];
  }
}

function write(key: string, entries: SavedTranslation[]) {
  localStorage.setItem(key, JSON.stringify(entries));
}

export const translationStore = {
  history: () => read(HISTORY_KEY),
  favorites: () => read(FAVORITES_KEY),
  addHistory(entry: SavedTranslation) {
    write(HISTORY_KEY, [entry, ...read(HISTORY_KEY)].slice(0, 100));
  },
  toggleFavorite(entry: SavedTranslation) {
    const existing = read(FAVORITES_KEY);
    const found = existing.some((item) => item.input === entry.input && item.output === entry.output && item.source === entry.source && item.target === entry.target);
    write(FAVORITES_KEY, found ? existing.filter((item) => !(item.input === entry.input && item.output === entry.output && item.source === entry.source && item.target === entry.target)) : [entry, ...existing]);
    return !found;
  },
  isFavorite(entry: SavedTranslation) {
    return read(FAVORITES_KEY).some((item) => item.input === entry.input && item.output === entry.output && item.source === entry.source && item.target === entry.target);
  },
  clearHistory() { write(HISTORY_KEY, []); },
  clearFavorites() { write(FAVORITES_KEY, []); }
};
