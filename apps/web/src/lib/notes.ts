export type Note = {
  id: string;
  content: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ViewMode = 'edit' | 'split' | 'preview';
export type Theme = 'light' | 'dark';

type Line = { text: string; inCode: boolean };

const FENCE_RE = /^\s*(```|~~~)/;
const HEADING_RE = /^(#{1,6})\s+(.*\S)\s*$/;
const TAG_RE = /(?:^|\s)#([A-Za-z][\w-]*)/g;
const TASK_MARKER_RE = /^\[[ xX]\]$/;

// Marks lines inside fenced code blocks so headings and tags written in code are ignored.
function splitLines(content: string): Line[] {
  let inCode = false;
  return content.split('\n').map((text) => {
    if (FENCE_RE.test(text)) {
      inCode = !inCode;
      return { text, inCode: true };
    }
    return { text, inCode };
  });
}

function headingOf(line: Line): RegExpExecArray | null {
  return line.inCode ? null : HEADING_RE.exec(line.text);
}

export function getTitle(content: string): string {
  const lines = splitLines(content);
  for (const line of lines) {
    const heading = headingOf(line);
    if (heading) return heading[2];
  }
  const firstLine = lines.find((line) => !line.inCode && line.text.trim() !== '');
  return firstLine ? firstLine.text.trim() : 'Untitled';
}

export function hasHeading(content: string): boolean {
  return splitLines(content).some((line) => headingOf(line) !== null);
}

// The title is the first heading, so renaming rewrites that heading in the source.
export function renameNote(content: string, title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim() || 'Untitled';
  const lines = splitLines(content);
  for (const line of lines) {
    const heading = headingOf(line);
    if (heading) {
      line.text = `${heading[1]} ${clean}`;
      return lines.map((item) => item.text).join('\n');
    }
  }
  return `# ${clean}\n\n${content}`;
}

export function getTags(content: string): string[] {
  const tags = new Set<string>();
  for (const line of splitLines(content)) {
    if (line.inCode) continue;
    for (const match of line.text.matchAll(TAG_RE)) {
      tags.add(match[1].toLowerCase());
    }
  }
  return [...tags].sort();
}

export function allTags(notes: Note[]): string[] {
  return [...new Set(notes.flatMap((note) => getTags(note.content)))].sort();
}

// `offset` is where the list item starts in the source; the checkbox is the first `[ ]` after it.
export function toggleTask(content: string, offset: number): string {
  const start = content.indexOf('[', offset);
  if (start === -1) return content;
  const lineEnd = content.indexOf('\n', offset);
  if (lineEnd !== -1 && start > lineEnd) return content;
  const marker = content.slice(start, start + 3);
  if (!TASK_MARKER_RE.test(marker)) return content;
  const next = marker === '[ ]' ? '[x]' : '[ ]';
  return content.slice(0, start) + next + content.slice(start + 3);
}

export function createNote(content: string, now = Date.now()): Note {
  return {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
}

const WELCOME = `# Welcome to Markdown Notes

Everything you write is saved in this browser. There is no account and no server.

- **Create** a note with the **+ New note** button or \`Ctrl/Cmd + N\`.
- **Search** with \`Ctrl/Cmd + K\`, or filter by a tag in the sidebar.
- **Pin** the notes you come back to often.
- **Switch views** between edit, split and preview in the toolbar.
- **Export** the current note as a \`.md\` file, or **import** one.

The first heading is the note's title. Tags such as #welcome and #getting-started are picked up automatically.
`;

const CHEAT_SHEET = `# Markdown cheat sheet

Tagged #reference #markdown

## Text

*Italic*, **bold**, ~~strikethrough~~ and \`inline code\`.

A [link](https://commonmark.org) to the spec.

## Lists

- Bullet item
  - Nested item
1. Numbered item
2. Second item

## Code

\`\`\`ts
function greet(name: string) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Table

| Syntax    | Result        | Notes            |
| --------- | ------------- | ---------------- |
| \`# Title\` | Large heading | One per note     |
| \`- [ ]\`   | Checkbox      | Click to toggle  |
| \`> text\`  | Block quote   | Good for asides  |

## Quote

> Plain text is the source of truth. The preview is just a view of it.
`;

const CHECKLIST = `# First-week checklist

Tagged #planning

- [x] Create a note
- [x] Type some Markdown and watch the preview update
- [ ] Pin the notes you use every day
- [ ] Export a note as \`.md\`
- [ ] Try the light and dark theme
`;

export function createSeedNotes(now = Date.now()): Note[] {
  // The cheat sheet is first and selected, so the first view shows code, a table and a checklist.
  return [
    { ...createNote(CHEAT_SHEET, now), pinned: true },
    createNote(WELCOME, now - 60_000),
    createNote(CHECKLIST, now - 120_000),
  ];
}

export function visibleNotes(notes: Note[], query: string, tag: string | null): Note[] {
  const needle = query.trim().toLowerCase();
  return notes
    .filter((note) => !needle || note.content.toLowerCase().includes(needle))
    .filter((note) => !tag || getTags(note.content).includes(tag))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}

export function exportFileName(content: string): string {
  const slug = (getTitle(content).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).join('-');
  return `${slug || 'note'}.md`;
}
