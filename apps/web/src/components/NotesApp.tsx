'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ChangeEvent } from 'react';
import {
  allTags,
  createNote,
  createSeedNotes,
  exportFileName,
  getTitle,
  hasHeading,
  renameNote,
  toggleTask,
  visibleNotes,
  type Note,
  type Theme,
  type ViewMode,
} from '@/lib/notes';
import {
  applyTheme,
  currentTheme,
  loadActiveId,
  loadNotes,
  saveActiveId,
  saveNotes,
} from '@/lib/storage';

import { Preview } from './Preview';
import { Sidebar } from './Sidebar';

const SAVE_DELAY_MS = 300;

const VIEWS: { mode: ViewMode; label: string }[] = [
  { mode: 'edit', label: 'Edit' },
  { mode: 'split', label: 'Split' },
  { mode: 'preview', label: 'Preview' },
];

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

// Storage only exists in the browser, so the workspace mounts after hydration and reads it then.
export function NotesApp() {
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  if (!mounted) return <div className="loading" aria-busy="true" />;
  return <NotesWorkspace />;
}

function NotesWorkspace() {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes() ?? createSeedNotes());
  const [activeId, setActiveId] = useState<string | null>(loadActiveId);
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const [view, setView] = useState<ViewMode>('split');
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  const searchRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const unsaved = useRef<Note[] | null>(null);

  // Autosave: every change, including the first seed, is written shortly after it happens.
  useEffect(() => {
    unsaved.current = notes;
    const timer = setTimeout(() => {
      saveNotes(notes);
      unsaved.current = null;
      setSaveStatus('saved');
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [notes]);

  // Don't lose the last edit if the tab closes before the debounce fires.
  useEffect(() => {
    const flush = () => {
      if (unsaved.current) saveNotes(unsaved.current);
      unsaved.current = null;
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const edit = useCallback((change: (current: Note[]) => Note[]) => {
    setSaveStatus('saving');
    setNotes(change);
  }, []);

  const updateNote = useCallback(
    (id: string, change: (note: Note) => Partial<Note>) =>
      edit((current) =>
        current.map((note) => (note.id === id ? { ...note, ...change(note) } : note)),
      ),
    [edit],
  );

  const selectNote = (id: string) => {
    setActiveId(id);
    saveActiveId(id);
  };

  const addNote = useCallback(() => {
    const note = createNote('# Untitled\n\n');
    edit((current) => [note, ...current]);
    setActiveId(note.id);
    saveActiveId(note.id);
    setQuery('');
    setTagFilter(null);
    setView((mode) => (mode === 'preview' ? 'split' : mode));
    editorRef.current?.focus();
  }, [edit]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === 'n') {
        event.preventDefault();
        addNote();
      } else if (key === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addNote]);

  const deleteNote = (id: string) => {
    const note = notes?.find((item) => item.id === id);
    if (!note || !window.confirm(`Delete "${getTitle(note.content)}"?`)) return;
    edit((current) => current.filter((item) => item.id !== id));
  };

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  const importFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    const imported = await Promise.all(
      files.map(async (file) => {
        const text = await file.text();
        const name = file.name.replace(/\.(md|markdown|txt)$/i, '');
        return createNote(hasHeading(text) ? text : `# ${name}\n\n${text}`);
      }),
    );
    if (imported.length === 0) return;
    edit((current) => [...imported, ...current]);
    selectNote(imported[0].id);
    setQuery('');
    setTagFilter(null);
  };

  const exportActive = () => {
    if (!active) return;
    const url = URL.createObjectURL(new Blob([active.content], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName(active.content);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const visible = useMemo(() => visibleNotes(notes, query, tagFilter), [notes, query, tagFilter]);
  const tags = useMemo(() => allTags(notes), [notes]);
  const active = notes.find((note) => note.id === activeId) ?? visible[0] ?? null;

  return (
    <div className="app">
      <Sidebar
        notes={visible}
        total={notes.length}
        activeId={active?.id ?? null}
        query={query}
        onQueryChange={setQuery}
        searchRef={searchRef}
        tags={tags}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        onCreate={addNote}
        onSelect={selectNote}
        onRename={(id, title) =>
          updateNote(id, (note) => ({ content: renameNote(note.content, title), updatedAt: Date.now() }))
        }
        onTogglePin={(id) => updateNote(id, (note) => ({ pinned: !note.pinned }))}
        onDelete={deleteNote}
      />

      <main className="main">
        <header className="toolbar">
          <div className="toolbar-title">{active ? getTitle(active.content) : 'No note selected'}</div>

          <div className="view-switch" role="group" aria-label="View mode">
            {VIEWS.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                data-testid={`view-${mode}`}
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="save-status" data-testid="save-status" aria-live="polite">
            {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
          </span>

          <div className="toolbar-actions">
            <button type="button" data-testid="import-note" onClick={() => importRef.current?.click()}>
              Import .md
            </button>
            <input
              ref={importRef}
              type="file"
              hidden
              multiple
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              data-testid="import-input"
              onChange={importFiles}
            />
            <button type="button" data-testid="export-note" disabled={!active} onClick={exportActive}>
              Export .md
            </button>
            <button
              type="button"
              data-testid="theme-toggle"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? 'Light theme' : 'Dark theme'}
            </button>
          </div>
        </header>

        {active ? (
          <div className={`workspace view-${view}`}>
            {view !== 'preview' && (
              <textarea
                ref={editorRef}
                className="editor"
                data-testid="editor"
                aria-label="Markdown source"
                placeholder="Write in Markdown…"
                spellCheck={false}
                value={active.content}
                onChange={(event) =>
                  updateNote(active.id, () => ({ content: event.target.value, updatedAt: Date.now() }))
                }
              />
            )}
            {view !== 'edit' && (
              <Preview
                source={active.content}
                onToggleTask={(offset) =>
                  updateNote(active.id, (note) => ({
                    content: toggleTask(note.content, offset),
                    updatedAt: Date.now(),
                  }))
                }
              />
            )}
          </div>
        ) : (
          <div className="empty-state">
            <p>No notes yet.</p>
            <button type="button" className="primary" onClick={addNote}>
              Create your first note
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
