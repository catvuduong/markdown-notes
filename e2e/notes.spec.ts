import { readFileSync } from 'node:fs';
import { test, expect, type Locator, type Page } from '@playwright/test';

const WELCOME = 'Welcome to Markdown Notes';
const CHEAT_SHEET = 'Markdown cheat sheet';
const CHECKLIST = 'First-week checklist';

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('editor')).toBeVisible();
}

function noteTitles(page: Page) {
  return page.locator('[data-testid="note-item"] .note-title').allTextContents();
}

function noteRow(page: Page, title: string): Locator {
  return page.locator('.note-row').filter({ hasText: title });
}

async function createNote(page: Page, content: string) {
  await page.getByTestId('new-note').click();
  await page.getByTestId('editor').fill(content);
}

test('first load seeds three welcome notes', async ({ page }) => {
  await openApp(page);

  await expect(page.getByTestId('note-item')).toHaveCount(3);
  expect(await noteTitles(page)).toEqual([CHEAT_SHEET, WELCOME, CHECKLIST]);
  await expect(page.getByTestId('preview').getByRole('heading', { level: 1 })).toHaveText(CHEAT_SHEET);
  await expect(page.getByTestId('preview').locator('table')).toBeVisible();
});

test('creates a note from the button and from Ctrl/Cmd+N', async ({ page }) => {
  await openApp(page);

  await page.getByTestId('new-note').click();
  await expect(page.getByTestId('note-item')).toHaveCount(4);
  await expect(page.getByTestId('editor')).toHaveValue('# Untitled\n\n');
  await expect(page.getByTestId('editor')).toBeFocused();

  await page.keyboard.press('ControlOrMeta+N');
  await expect(page.getByTestId('note-item')).toHaveCount(5);
});

test('typing markdown shows it in the preview', async ({ page }) => {
  await openApp(page);
  await createNote(
    page,
    [
      '# Shopping',
      '',
      '- milk',
      '',
      '**bold** and `code`',
      '',
      '| item | qty |',
      '| ---- | --- |',
      '| eggs | 12  |',
      '',
      '```ts',
      'const answer = 42;',
      '```',
    ].join('\n'),
  );

  const preview = page.getByTestId('preview');
  await expect(preview.getByRole('heading', { level: 1 })).toHaveText('Shopping');
  await expect(preview.locator('li', { hasText: 'milk' })).toBeVisible();
  await expect(preview.locator('strong')).toHaveText('bold');
  await expect(preview.locator('td', { hasText: '12' })).toBeVisible();
  await expect(preview.locator('pre .hljs-keyword', { hasText: 'const' })).toBeVisible();
  await expect(noteRow(page, 'Shopping')).toBeVisible();
});

test('clicking a task checkbox in the preview toggles it in the source', async ({ page }) => {
  await openApp(page);
  await createNote(page, '# Tasks\n\n- [ ] write tests\n- [x] ship it\n');

  const boxes = page.getByTestId('preview').getByRole('checkbox');
  await boxes.nth(0).click();
  await expect(page.getByTestId('editor')).toHaveValue(/- \[x\] write tests/);
  await expect(boxes.nth(0)).toBeChecked();

  await boxes.nth(1).click();
  await expect(page.getByTestId('editor')).toHaveValue(/- \[ \] ship it/);
  await expect(boxes.nth(1)).not.toBeChecked();
});

test('search filters notes by content and Ctrl/Cmd+K focuses it', async ({ page }) => {
  await openApp(page);

  await page.keyboard.press('ControlOrMeta+K');
  const search = page.getByTestId('search-input');
  await expect(search).toBeFocused();

  await search.fill('pin the notes');
  await expect(page.getByTestId('note-item')).toHaveCount(1);
  expect(await noteTitles(page)).toEqual([CHECKLIST]);

  await search.fill('no such words anywhere');
  await expect(page.getByTestId('note-item')).toHaveCount(0);
  await expect(page.getByText('No notes match this search.')).toBeVisible();

  await search.fill('');
  await expect(page.getByTestId('note-item')).toHaveCount(3);
});

test('tag filter narrows the list to notes with that hashtag', async ({ page }) => {
  await openApp(page);

  await page.getByTestId('tag-filter').filter({ hasText: '#planning' }).click();
  expect(await noteTitles(page)).toEqual([CHECKLIST]);

  await page.getByTestId('tag-filter').filter({ hasText: '#planning' }).click();
  await expect(page.getByTestId('note-item')).toHaveCount(3);
});

test('pinning moves a note to the top and unpinning restores the order', async ({ page }) => {
  await openApp(page);
  const checklist = noteRow(page, CHECKLIST);

  await checklist.getByTestId('pin-note').click();
  await expect(checklist.getByTestId('pin-note')).toHaveAttribute('aria-pressed', 'true');
  expect(await noteTitles(page)).toEqual([CHEAT_SHEET, CHECKLIST, WELCOME]);

  await checklist.getByTestId('pin-note').click();
  await expect(checklist.getByTestId('pin-note')).toHaveAttribute('aria-pressed', 'false');
  expect(await noteTitles(page)).toEqual([CHEAT_SHEET, WELCOME, CHECKLIST]);
});

test('renames a note by rewriting its first heading', async ({ page }) => {
  await openApp(page);

  await noteRow(page, CHECKLIST).getByTestId('note-item').click();
  await noteRow(page, CHECKLIST).getByTestId('rename-note').click();
  await page.getByTestId('rename-input').fill('Renamed plan');
  await page.getByTestId('rename-input').press('Enter');

  await expect(noteRow(page, 'Renamed plan')).toBeVisible();
  await expect(page.getByTestId('editor')).toHaveValue(/^# Renamed plan$/m);
});

test('deletes a note after confirmation', async ({ page }) => {
  await openApp(page);
  page.once('dialog', (dialog) => dialog.accept());

  await noteRow(page, CHEAT_SHEET).getByTestId('delete-note').click();

  await expect(page.getByTestId('note-item')).toHaveCount(2);
  expect(await noteTitles(page)).not.toContain(CHEAT_SHEET);
});

test('notes and the selected note survive a reload', async ({ page }) => {
  await openApp(page);
  await createNote(page, '# Persistent idea\n\nStays after reload.');

  await page.waitForFunction(() =>
    (window.localStorage.getItem('markdown-notes.notes') ?? '').includes('Stays after reload.'),
  );
  await expect(page.getByTestId('save-status')).toHaveText('Saved');

  await page.reload();
  await expect(page.getByTestId('editor')).toBeVisible();
  await expect(noteRow(page, 'Persistent idea')).toBeVisible();
  await expect(page.getByTestId('editor')).toHaveValue(/Stays after reload\./);
});

test('theme toggle switches colours and is remembered across reloads', async ({ page }) => {
  await openApp(page);
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);

  await page.getByTestId('theme-toggle').click();
  expect(await theme()).toBe('dark');

  await page.reload();
  await expect(page.getByTestId('editor')).toBeVisible();
  expect(await theme()).toBe('dark');

  await page.getByTestId('theme-toggle').click();
  expect(await theme()).toBe('light');
  await page.reload();
  await expect(page.getByTestId('editor')).toBeVisible();
  expect(await theme()).toBe('light');
});

test('view buttons switch between edit, split and preview', async ({ page }) => {
  await openApp(page);

  await page.getByTestId('view-edit').click();
  await expect(page.getByTestId('editor')).toBeVisible();
  await expect(page.getByTestId('preview')).toHaveCount(0);

  await page.getByTestId('view-preview').click();
  await expect(page.getByTestId('preview')).toBeVisible();
  await expect(page.getByTestId('editor')).toHaveCount(0);

  await page.getByTestId('view-split').click();
  await expect(page.getByTestId('editor')).toBeVisible();
  await expect(page.getByTestId('preview')).toBeVisible();
});

test('exports the current note as a .md file', async ({ page }) => {
  await openApp(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-note').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('markdown-cheat-sheet.md');
  expect(readFileSync(await download.path(), 'utf8')).toContain(`# ${CHEAT_SHEET}`);
});

test('imports .md files as new notes', async ({ page }) => {
  await openApp(page);

  await page.getByTestId('import-input').setInputFiles({
    name: 'ideas.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('Imported text without a heading\n\n- first idea'),
  });

  await expect(page.getByTestId('note-item')).toHaveCount(4);
  await expect(noteRow(page, 'ideas')).toBeVisible();
  await expect(page.getByTestId('editor')).toHaveValue(/^# ideas\n\nImported text/);
});
