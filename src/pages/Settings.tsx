import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Download, HardDrive, Keyboard, Monitor, Moon, Smartphone, Sun, Upload } from 'lucide-preact';
import { PageHeader } from '../components/PageHeader';
import { PALETTES, palettePref, themePref, type ThemePref } from '../lib/theme';
import { installPrompt, isIOS, isStandalone, promptInstall } from '../lib/pwa';
import { previewsEnabled } from '../lib/previews';
import { archiveSemester, setSetting, unarchiveSemester } from '../lib/repo';
import { formatBytes, requestPersistence } from '../lib/files';
import { exportBackup, exportMarkdown, importBackup, importBookmarks } from '../lib/backup';
import { toDateInput } from '../lib/dates';
import { toast, toastError } from '../lib/toast';
import { db } from '../lib/db';
import { shortcutsOpen } from '../state';
import { enableReminders, remindersEnabled } from '../lib/reminders';
import { AI_DAILY_LIMIT, aiAvailable, aiEnabled, aiReview, checkAiAvailable, setAiEnabled, setAiReview, usedToday } from '../lib/ai';
import { Modal } from '../components/Modal';
import { autoTagEnabled } from '../lib/actions';

export function Section({ title, description, children }: { title: string; description?: string; children: ComponentChildren }) {
  return (
    <section class="card p-4 sm:p-5 space-y-4">
      <div>
        <h2 class="font-display text-base font-medium">{title}</h2>
        {description && <p class="text-sm text-subtle mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="flex items-start justify-between gap-4 cursor-pointer">
      <span>
        <span class="text-sm font-medium block">{label}</span>
        {description && <span class="text-xs text-subtle block mt-0.5">{description}</span>}
      </span>
      <span class="relative shrink-0 mt-0.5">
        <input type="checkbox" role="switch" class="peer sr-only" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
        <span class="block w-10 h-6 rounded-full bg-border2 peer-checked:bg-accent transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-accent peer-focus-visible:outline-offset-2" />
        <span class="absolute top-1 left-1 w-4 h-4 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Today's local date, so a backup made at 7am in Manila isn't named after yesterday (the UTC date).
const stamp = () => toDateInput(Date.now());

function StorageMeter() {
  const [est, setEst] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
  const refresh = async () => {
    const e = await navigator.storage?.estimate?.().catch(() => undefined);
    const persisted = (await navigator.storage?.persisted?.().catch(() => false)) ?? false;
    if (e?.usage !== undefined && e.quota !== undefined) setEst({ usage: e.usage, quota: e.quota, persisted });
  };
  useEffect(() => void refresh(), []);
  if (!est) return null;
  const pct = Math.min(100, (est.usage / est.quota) * 100);
  return (
    <div class="space-y-2">
      <div class="flex items-center gap-2 text-sm">
        <HardDrive size={16} class="text-subtle" />
        <span class="flex-1">
          {formatBytes(est.usage)} used of about {formatBytes(est.quota)} available
        </span>
      </div>
      <div class="h-2 rounded-full bg-surface3 overflow-hidden">
        <div class="h-full bg-accent" style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
      <p class="text-xs text-subtle">
        {est.persisted
          ? 'Storage is persistent: the browser won’t clear Cove’s data to free space.'
          : 'The browser may clear site data when the device runs low on space. Installing Cove or allowing persistent storage prevents that.'}
      </p>
      {!est.persisted && (
        <button
          class="btn"
          onClick={async () => {
            const ok = await requestPersistence();
            toast(ok ? 'Storage is now persistent' : 'The browser didn’t allow it. Installing Cove usually does.');
            void refresh();
          }}
        >
          Keep my data safe
        </button>
      )}
    </div>
  );
}

function DangerZone() {
  const [text, setText] = useState('');
  return (
    <Section title="Delete everything" description="Removes every item, space and file from this device. This can’t be undone, so export a backup first.">
      <div class="flex flex-col sm:flex-row gap-2">
        <input class="input" placeholder='Type "DELETE" to confirm' value={text} onInput={(e) => setText(e.currentTarget.value)} aria-label="Confirm deletion" />
        <button
          class="btn btn-danger"
          disabled={text !== 'DELETE'}
          onClick={async () => {
            await Promise.all([db.items.clear(), db.spaces.clear(), db.files.clear()]);
            setText('');
            toast('Everything was deleted');
          }}
        >
          Delete all data
        </button>
      </div>
    </Section>
  );
}

export function Settings() {
  const backupInput = useRef<HTMLInputElement>(null);
  const bookmarksInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    try {
      await task();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  const themes: { value: ThemePref; label: string; icon: ComponentChildren }[] = [
    { value: 'system', label: 'System', icon: <Monitor size={16} /> },
    { value: 'light', label: 'Light', icon: <Sun size={16} /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={16} /> },
  ];

  return (
    <>
      <PageHeader title="Settings" />
      <div class="px-3 md:px-6 py-3 md:py-4 max-w-2xl mx-auto w-full space-y-4">
        <Section title="Appearance">
          <div>
            <span class="label" id="theme-label">Theme</span>
            <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="theme-label">
              {themes.map((t) => (
                <button
                  key={t.value}
                  role="radio"
                  aria-checked={themePref.value === t.value}
                  class={`btn h-11 ${themePref.value === t.value ? 'btn-soft ring-1 ring-accent' : ''}`}
                  onClick={() => (themePref.value = t.value)}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span class="label" id="palette-label">Color</span>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-labelledby="palette-label">
              {PALETTES.map((p) => {
                const on = palettePref.value === p.value;
                return (
                  <button
                    key={p.value}
                    role="radio"
                    aria-checked={on}
                    class={`btn h-11 justify-start ${on ? 'btn-soft ring-1 ring-accent' : ''}`}
                    onClick={() => (palettePref.value = p.value)}
                  >
                    <span class="w-5 h-5 rounded-full shrink-0 border border-border2" style={{ background: p.swatch }} />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        <Section title="Install" description="Installed, Cove opens in its own window, works offline and can receive shared links.">
          {isStandalone() ? (
            <p class="text-sm text-muted">You’re using the installed app.</p>
          ) : installPrompt.value ? (
            <button class="btn btn-primary" onClick={() => void promptInstall()}>
              <Download size={16} /> Install Cove
            </button>
          ) : isIOS() ? (
            <p class="text-sm text-muted flex gap-2">
              <Smartphone size={16} class="shrink-0 mt-0.5" /> In Safari, tap the Share button, then “Add to Home Screen”.
            </p>
          ) : (
            <p class="text-sm text-muted">Use your browser’s menu and choose “Install app” or “Add to Home screen”.</p>
          )}
        </Section>

        <Section
          title="Reminders"
          description="Browsers only run web apps while they’re open, so notifications arrive while Cove is open or running in the background. For alerts that always arrive, use “Add to my calendar” on a task or export all deadlines from the Tasks page."
        >
          <Toggle
            label="Show reminder notifications"
            description="Asks for notification permission. When it’s off, reminders appear inside the app."
            checked={remindersEnabled.value}
            onChange={(v) => void enableReminders(v)}
          />
        </Section>

        <AiSettings />

        <Section title="Links">
          <Toggle
            label="Tag links by site"
            description="Adds #video for YouTube, #docs for Google Docs, #code for GitHub, #classroom, #meeting and a few more."
            checked={autoTagEnabled.value}
            onChange={(v) => {
              autoTagEnabled.value = v;
              void setSetting('autoTag', v);
            }}
          />
          <Toggle
            label="Fetch link previews"
            description="Sends saved links to Cove’s server to read their title, description and image. Turn off to keep links entirely on this device."
            checked={previewsEnabled.value}
            onChange={(v) => {
              previewsEnabled.value = v;
              void setSetting('linkPreviews', v);
            }}
          />
        </Section>

        <Section title="Your data" description="Everything is stored on this device. Back it up now and then, or move it to another device.">
          <StorageMeter />
          <div class="grid sm:grid-cols-2 gap-2 pt-1">
            <button class="btn" disabled={!!busy} onClick={() => run('backup', async () => download(await exportBackup(), `cove-backup-${stamp()}.zip`))}>
              <Download size={16} /> {busy === 'backup' ? 'Preparing…' : 'Export backup'}
            </button>
            <button class="btn" disabled={!!busy} onClick={() => backupInput.current?.click()}>
              <Upload size={16} /> {busy === 'import' ? 'Importing…' : 'Import backup'}
            </button>
            <button class="btn" disabled={!!busy} onClick={() => run('md', async () => download(await exportMarkdown(), `cove-markdown-${stamp()}.zip`))}>
              <Download size={16} /> {busy === 'md' ? 'Preparing…' : 'Export as Markdown'}
            </button>
            <button class="btn" disabled={!!busy} onClick={() => bookmarksInput.current?.click()}>
              <Upload size={16} /> {busy === 'bookmarks' ? 'Importing…' : 'Import browser bookmarks'}
            </button>
          </div>
          <p class="text-xs text-subtle">
            Backups include files, quick links and focus history, and can be imported on any device; newer edits are never overwritten by older ones. For bookmarks, export them from your
            browser as an HTML file first.
          </p>
          <input
            ref={backupInput}
            type="file"
            accept=".zip,.json,application/zip,application/json"
            class="hidden"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (f)
                void run('import', async () => {
                  const r = await importBackup(f);
                  toast(`Imported ${r.items} items, ${r.spaces} spaces and ${r.files} files${r.skipped ? ` (${r.skipped} skipped)` : ''}`);
                });
            }}
          />
          <input
            ref={bookmarksInput}
            type="file"
            accept=".html,.htm,text/html"
            class="hidden"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (f)
                void run('bookmarks', async () => {
                  const n = await importBookmarks(await f.text());
                  toast(n ? `Imported ${n} bookmarks, tagged #bookmarks` : 'No new bookmarks found');
                });
            }}
          />
        </Section>

        <NewSemester />

        <Section title="Keyboard">
          <button class="btn" onClick={() => (shortcutsOpen.value = true)}>
            <Keyboard size={16} /> Show keyboard shortcuts
          </button>
        </Section>

        <DangerZone />

        <p class="text-xs text-subtle text-center pb-4">Cove {__APP_VERSION__}</p>
      </div>
    </>
  );
}

function AiSettings() {
  const [consenting, setConsenting] = useState(false);
  useEffect(() => void checkAiAvailable(), []);

  return (
    <Section title="AI helpers" description="Optional. Summarize notes, suggest tags, pull tasks and deadlines out of announcements, and make practice quizzes.">
      {aiAvailable.value === false && <p class="text-sm text-subtle">AI isn’t set up on this server, so these features are unavailable.</p>}
      <Toggle
        label="Turn on AI helpers"
        description="Off by default. Nothing is sent until you pick an AI action on an item."
        checked={aiEnabled.value}
        onChange={(v) => (v ? setConsenting(true) : void setAiEnabled(false))}
      />
      <Toggle
        label="Show me what’s sent first"
        description="Review the exact text before each request."
        checked={aiReview.value}
        onChange={(v) => void setAiReview(v)}
      />
      {aiEnabled.value && (
        <p class="text-xs text-subtle">
          Used today on this device: {usedToday()} of {AI_DAILY_LIMIT}.
        </p>
      )}
      {consenting && (
        <Modal title="Before you turn on AI" onClose={() => setConsenting(false)}>
          <div class="space-y-3 text-sm pt-1">
            <p>When you use an AI action, the item’s text is sent to Groq, an AI provider, to produce the answer. Cove’s server passes it along and doesn’t store it.</p>
            <ul class="list-disc pl-5 space-y-1 text-muted">
              <li>Private items and spaces set to stay away from AI are never sent.</li>
              <li>Emails, phone numbers, passwords and keys are hidden before sending.</li>
              <li>At most 8,000 characters go out per request, and only when you ask.</li>
              <li>Results are suggestions: nothing changes until you accept them.</li>
              <li>AI can be wrong. Don’t rely on it for grades without checking.</li>
            </ul>
            <div class="flex justify-end gap-2 pt-2">
              <button class="btn btn-ghost" onClick={() => setConsenting(false)}>Not now</button>
              <button
                class="btn btn-primary"
                onClick={async () => {
                  await setAiEnabled(true);
                  setConsenting(false);
                  toast('AI helpers are on. Find them under the ✨ button on any item.');
                }}
              >
                Turn on
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Section>
  );
}

function NewSemester() {
  const [confirming, setConfirming] = useState(false);
  return (
    <Section title="New semester" description="Archives every space and everything in it, so you start the term with a clean sidebar. Nothing is deleted: it all stays searchable under Archive.">
      {confirming ? (
        <div class="flex flex-wrap gap-2">
          <button
            class="btn btn-primary"
            onClick={async () => {
              const changed = await archiveSemester();
              setConfirming(false);
              const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
              toast(`Archived ${count(changed.spaceIds.length, 'space')} and ${count(changed.itemIds.length, 'item')}`, {
                action: { label: 'Undo', run: () => void unarchiveSemester(changed) },
                ms: 10_000,
              });
            }}
          >
            Archive all spaces
          </button>
          <button class="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      ) : (
        <button class="btn" onClick={() => setConfirming(true)}>Start a new semester</button>
      )}
    </Section>
  );
}
