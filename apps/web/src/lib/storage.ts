import type { Note, Theme } from './notes';

export const NOTES_KEY = 'markdown-notes.notes';
export const ACTIVE_KEY = 'markdown-notes.active';
export const THEME_KEY = 'markdown-notes.theme';

function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null) return false;
  const note = value as Record<string, unknown>;
  return (
    typeof note.id === 'string' &&
    typeof note.content === 'string' &&
    typeof note.pinned === 'boolean' &&
    typeof note.createdAt === 'number' &&
    typeof note.updatedAt === 'number'
  );
}

// Storage can be blocked (private windows, disabled site data), so every access is guarded.
export function loadNotes(): Note[] | null {
  try {
    const raw = window.localStorage.getItem(NOTES_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isNote) : null;
  } catch {
    return null;
  }
}

export function saveNotes(notes: Note[]): void {
  try {
    window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch {
    // Quota exceeded or storage blocked: the notes stay in memory for this session.
  }
}

export function loadActiveId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveId(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // Remembering the selected note is a convenience, so failures are ignored.
  }
}

// The inline script in layout.tsx applies the saved theme before first paint; this reads it back.
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // The theme still applies for this visit.
  }
}
