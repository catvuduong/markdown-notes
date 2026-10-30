import { useState } from 'react';
import type { RefObject } from 'react';
import { getTags, getTitle, type Note } from '@/lib/notes';

type SidebarProps = {
  notes: Note[];
  total: number;
  activeId: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  tags: string[];
  tagFilter: string | null;
  onTagFilterChange: (tag: string | null) => void;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Sidebar({
  notes,
  total,
  activeId,
  query,
  onQueryChange,
  searchRef,
  tags,
  tagFilter,
  onTagFilterChange,
  onCreate,
  onSelect,
  onRename,
  onTogglePin,
  onDelete,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="brand">Markdown Notes</span>
        <button type="button" className="primary" data-testid="new-note" onClick={onCreate}>
          + New note
        </button>
      </div>

      <input
        ref={searchRef}
        type="search"
        className="search"
        data-testid="search-input"
        aria-label="Search notes"
        placeholder="Search notes (Ctrl/Cmd+K)"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />

      {tags.length > 0 && (
        <div className="tags" role="group" aria-label="Filter by tag">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="tag"
              data-testid="tag-filter"
              aria-pressed={tagFilter === tag}
              onClick={() => onTagFilterChange(tagFilter === tag ? null : tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <ul className="note-list" aria-label="Notes">
        {notes.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            active={note.id === activeId}
            onSelect={() => onSelect(note.id)}
            onRename={(title) => onRename(note.id, title)}
            onTogglePin={() => onTogglePin(note.id)}
            onDelete={() => onDelete(note.id)}
          />
        ))}
      </ul>

      {notes.length === 0 && (
        <p className="empty-list">{total === 0 ? 'No notes yet.' : 'No notes match this search.'}</p>
      )}
    </aside>
  );
}

type NoteRowProps = {
  note: Note;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onTogglePin: () => void;
  onDelete: () => void;
};

function NoteRow({ note, active, onSelect, onRename, onTogglePin, onDelete }: NoteRowProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const title = getTitle(note.content);
  const tags = getTags(note.content);

  const startRename = () => {
    setDraft(title);
    setRenaming(true);
  };

  const finishRename = () => {
    setRenaming(false);
    const next = draft.trim();
    if (next && next !== title) onRename(next);
  };

  return (
    <li className={active ? 'note-row active' : 'note-row'}>
      {renaming ? (
        <form
          className="rename-form"
          onSubmit={(event) => {
            event.preventDefault();
            finishRename();
          }}
        >
          <input
            autoFocus
            data-testid="rename-input"
            aria-label="Note title"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setRenaming(false);
            }}
          />
        </form>
      ) : (
        <button
          type="button"
          className="note-select"
          data-testid="note-item"
          aria-current={active ? 'true' : undefined}
          onClick={onSelect}
        >
          <span className="note-title">{title}</span>
          <span className="note-meta">
            Edited {formatTime(note.updatedAt)}
            {tags.length > 0 && ` · #${tags.join(' #')}`}
          </span>
        </button>
      )}

      <div className="note-actions">
        {note.pinned && <span className="pin-badge" data-testid="pin-badge">Pinned</span>}
        <button type="button" data-testid="pin-note" aria-pressed={note.pinned} onClick={onTogglePin}>
          {note.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button type="button" data-testid="rename-note" onClick={startRename}>
          Rename
        </button>
        <button type="button" data-testid="delete-note" onClick={onDelete}>
          Delete
        </button>
      </div>
    </li>
  );
}
