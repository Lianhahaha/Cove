import { useState } from 'preact/hooks';
import { ArrowDown, ArrowUp, Globe, Plus, X } from 'lucide-preact';
import { addQuickLink, LINK_PRESETS, logoFor, moveQuickLink, QUICK_LINK_LIMITS, quickLinks, removeQuickLink } from '../lib/links';
import { hostOf } from '../lib/queries';
import { Modal } from './Modal';
import { toast } from '../lib/toast';
import { InfoTip } from './InfoTip';

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
  const [managing, setManaging] = useState(false);
  const links = quickLinks.value;

  return (
    <section>
      <div class="flex items-center gap-1.5 mb-2">
        <h2 class="section-title">Quick links</h2>
        <InfoTip label="Quick links">One tap opens these sites, or their app if it’s installed on your phone. Tap Add to add more or remove any.</InfoTip>
      </div>
      <ul class="flex gap-1 overflow-x-auto -mx-3 px-1.5 pb-1" aria-label="Quick links">
        {links.map((l) => (
          <li key={l.id} class="shrink-0">
            <a class="quick-link" href={l.url} target="_blank" rel="noopener noreferrer" title={`Open ${hostOf(l.url)}`}>
              <span class={`quick-link-icon ${logoFor(l) ? 'quick-link-logo' : ''}`}>
                <LinkLogo url={l.url} icon={l.icon} size={logoFor(l) ? 28 : 20} />
              </span>
              <span class="quick-link-name">{l.name}</span>
            </a>
          </li>
        ))}
        <li class="shrink-0">
          <button class="quick-link" aria-label="Add or remove quick links" onClick={() => setManaging(true)}>
            <span class="quick-link-icon quick-link-add">
              <Plus size={20} />
            </span>
            <span class="quick-link-name text-subtle">Add</span>
          </button>
        </li>
      </ul>
      {managing && <ManageLinksDialog onClose={() => setManaging(false)} />}
    </section>
  );
}

/** One place to add and remove quick links. It stays open, so several can be changed in one go. */
function ManageLinksDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const links = quickLinks.value;
  const full = links.length >= QUICK_LINK_LIMITS.count;
  const presets = LINK_PRESETS.filter((p) => !links.some((l) => hostOf(l.url) === hostOf(p.url)));

  async function add(n: string, u: string): Promise<boolean> {
    const problem = await addQuickLink(n, u);
    setError(problem);
    return !problem;
  }

  return (
    <Modal title="Quick links" size="sm" onClose={onClose}>
      <div class="space-y-5 pt-1">
        <section>
          <h3 class="label">Your links</h3>
          {links.length === 0 ? (
            <p class="text-sm text-subtle">None yet. Pick a suggestion or add your own below.</p>
          ) : (
            <ul class="space-y-1">
              {links.map((l, i) => (
                <li key={l.id} class="flex items-center gap-3 rounded-xl bg-surface2 pl-3 pr-1 py-1.5">
                  <span class="w-6 h-6 grid place-items-center shrink-0 text-subtle">
                    <LinkLogo url={l.url} icon={l.icon} size={20} />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm truncate">{l.name}</span>
                    <span class="block text-xs text-subtle truncate">{hostOf(l.url)}</span>
                  </span>
                  {/* Order on Home, left to right. */}
                  <button class="icon-btn w-8" aria-label={`Move ${l.name} earlier`} title="Move earlier" disabled={i === 0} onClick={() => void moveQuickLink(l.id, -1)}>
                    <ArrowUp size={16} />
                  </button>
                  <button class="icon-btn w-8" aria-label={`Move ${l.name} later`} title="Move later" disabled={i === links.length - 1} onClick={() => void moveQuickLink(l.id, 1)}>
                    <ArrowDown size={16} />
                  </button>
                  <button class="icon-btn" aria-label={`Remove ${l.name}`} title="Remove" onClick={async () => {
                      const undo = await removeQuickLink(l.id);
                      toast(`Removed ${l.name}`, {
                        action: {
                          label: 'Undo',
                          run: async () => {
                            if (!(await undo())) toast(`There’s no room to put ${l.name} back. Remove a link first.`, { tone: 'error' });
                          },
                        },
                      });
                    }}>
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {full ? (
          <p class="text-sm text-subtle">You can keep up to {QUICK_LINK_LIMITS.count} quick links. Remove one to add another.</p>
        ) : (
          <>
            {presets.length > 0 && (
              <section>
                <h3 class="label">Suggestions</h3>
                <div class="flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <button key={p.url} type="button" class="chip hover:border-accent py-1 px-2.5 text-sm" onClick={() => void add(p.name, p.url)}>
                      <LinkLogo url={p.url} size={16} />
                      {p.full}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <form
              class="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await add(name, url)) {
                  setName('');
                  setUrl('');
                }
              }}
            >
              <h3 class="label">Add your own</h3>
              <div>
                <label class="sr-only" for="ql-url">Link</label>
                <input
                  id="ql-url"
                  class="input"
                  // Text, not type="url": the browser would silently refuse addresses without https://.
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellcheck={false}
                  placeholder="Link, like portal.myschool.edu"
                  required
                  value={url}
                  onInput={(e) => {
                    setUrl(e.currentTarget.value);
                    setError(null);
                  }}
                />
              </div>
              <div>
                <label class="sr-only" for="ql-name">Name</label>
                <input id="ql-name" class="input" maxLength={QUICK_LINK_LIMITS.nameChars} placeholder="Name, like School portal (optional)" value={name} onInput={(e) => setName(e.currentTarget.value)} />
              </div>
              {error && (
                <p class="text-sm text-danger" role="alert">
                  {error}
                </p>
              )}
              <button class="btn btn-soft w-full">
                <Plus size={16} /> Add link
              </button>
            </form>
          </>
        )}

        <div class="flex justify-end">
          <button type="button" class="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </Modal>
  );
}
