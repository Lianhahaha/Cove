import { useState } from 'preact/hooks';
import { Globe, Plus, X } from 'lucide-preact';
import { addQuickLink, LINK_PRESETS, logoFor, QUICK_LINK_LIMITS, quickLinks, removeQuickLink } from '../lib/links';
import { hostOf } from '../lib/queries';
import { Modal } from './Modal';

/** Icons that failed to load this session, so tiles fall back to the globe without retrying. */
const broken = new Set<string>();

/**
 * The site's real logo: bundled for Google apps, the saved favicon for other sites,
 * and a globe when there's neither or it fails to load.
 */
export function LinkLogo({ url, icon, size = 20 }: { url: string; icon?: string; size?: number }) {
  const [, rerender] = useState(0);
  const src = logoFor({ url, icon });
  if (!src || broken.has(src)) return <Globe size={size} />;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerpolicy="no-referrer"
      class="object-contain"
      onError={() => {
        broken.add(src);
        rerender((n) => n + 1);
      }}
    />
  );
}

/** One-tap tiles on Home for the sites a student opens every day, starting with Google Classroom. */
export function QuickLinks() {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const links = quickLinks.value;
  const full = links.length >= QUICK_LINK_LIMITS.count;

  return (
    <section>
      <div class="flex items-center justify-between mb-2">
        <h2 class="section-title">Quick links</h2>
        {links.length > 0 && (
          <button class="text-sm text-accent hover:underline" aria-pressed={editing} onClick={() => setEditing(!editing)}>
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>
      <ul class="flex gap-1 overflow-x-auto -mx-3 px-1.5 pb-1" aria-label="Quick links">
        {links.map((l) => (
          <li key={l.id} class="relative shrink-0">
            <a class="quick-link" href={l.url} target="_blank" rel="noopener noreferrer" title={`Open ${hostOf(l.url)}`}>
              <span class={`quick-link-icon ${logoFor(l) ? 'quick-link-logo' : ''}`}>
                <LinkLogo url={l.url} icon={l.icon} size={logoFor(l) ? 28 : 20} />
              </span>
              <span class="quick-link-name">{l.name}</span>
            </a>
            {editing && (
              <button class="quick-link-remove" aria-label={`Remove ${l.name}`} onClick={() => void removeQuickLink(l.id)}>
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </li>
        ))}
        {!full && (
          <li class="shrink-0">
            <button class="quick-link" onClick={() => setAdding(true)}>
              <span class="quick-link-icon quick-link-add">
                <Plus size={20} />
              </span>
              <span class="quick-link-name text-subtle">Add</span>
            </button>
          </li>
        )}
      </ul>
      {adding && <AddLinkDialog onClose={() => setAdding(false)} />}
    </section>
  );
}

function AddLinkDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const presets = LINK_PRESETS.filter((p) => !quickLinks.value.some((l) => hostOf(l.url) === hostOf(p.url)));

  async function add(n: string, u: string) {
    const problem = await addQuickLink(n, u);
    if (problem) setError(problem);
    else onClose();
  }

  return (
    <Modal title="Add a quick link" size="sm" onClose={onClose}>
      <div class="space-y-4 pt-1">
        {presets.length > 0 && (
          <div>
            <span class="label">Suggestions</span>
            <div class="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button key={p.url} type="button" class="chip hover:border-accent py-1 px-2.5 text-sm" onClick={() => void add(p.name, p.url)}>
                  <LinkLogo url={p.url} size={16} />
                  {p.full}
                </button>
              ))}
            </div>
          </div>
        )}
        <form
          class="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void add(name, url);
          }}
        >
          <div>
            <label class="label" for="ql-url">Link</label>
            <input
              id="ql-url"
              class="input"
              // Text, not type="url": the browser would silently refuse addresses without https://.
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellcheck={false}
              placeholder="portal.myschool.edu"
              required
              value={url}
              onInput={(e) => {
                setUrl(e.currentTarget.value);
                setError(null);
              }}
            />
          </div>
          <div>
            <label class="label" for="ql-name">Name</label>
            <input id="ql-name" class="input" maxLength={QUICK_LINK_LIMITS.nameChars} placeholder="School portal" value={name} onInput={(e) => setName(e.currentTarget.value)} />
          </div>
          {error && (
            <p class="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div class="flex justify-end gap-2">
            <button type="button" class="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button class="btn btn-primary">Add link</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
