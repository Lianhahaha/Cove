import { useState } from 'preact/hooks';
import { ExternalLink, FolderOpen, GraduationCap, Settings2 } from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { hostOf, isActive } from '../lib/queries';
import { isClassroom } from '../lib/links';
import { LinkGlyph } from '../components/QuickLinks';
import { ItemsView } from '../components/ItemsView';
import { EmptyState } from '../components/EmptyState';
import { SpaceSettings } from '../components/SpaceSettings';
import { NewNoteButton } from '../components/NewNote';
import { updateSpace } from '../lib/repo';
import { NotFound } from './NotFound';

export function SpacePage({ id }: { id: string }) {
  const space = useLive(() => db.spaces.get(id), [id]);
  const [editing, setEditing] = useState(false);
  if (space === undefined) return null;
  if (!space || space.deletedAt) return <NotFound />;
  return (
    <>
      <ItemsView
        title={
          <span class="flex items-center gap-2">
            <span>{space.emoji}</span>
            {space.name}
          </span>
        }
        prefKey="space"
        deps={[id]}
        headerActions={
          <>
            <NewNoteButton spaceId={id} variant="icon" />
            <button class="icon-btn" title="Space settings" aria-label="Space settings" onClick={() => setEditing(true)}>
              <Settings2 size={18} />
            </button>
          </>
        }
        intro={
          <>
            {space.archived && (
              <div class="card p-3 flex items-center gap-3 text-sm bg-surface2">
                <span class="flex-1">This space is archived, so it's hidden from the sidebar and Home.</span>
                <button class="btn" onClick={() => updateSpace(space.id, { archived: false })}>Unarchive</button>
              </div>
            )}
            {space.link ? (
              <a class="btn btn-soft" href={space.link} target="_blank" rel="noopener noreferrer">
                <LinkGlyph url={space.link} size={16} />
                {isClassroom(space.link) ? 'Open in Google Classroom' : `Open ${hostOf(space.link)}`}
                <ExternalLink size={14} class="opacity-70" />
              </a>
            ) : (
              <button class="btn btn-ghost -ml-2 text-sm text-subtle" onClick={() => setEditing(true)}>
                <GraduationCap size={16} /> Add this class’s Classroom link
              </button>
            )}
          </>
        }
        defaultSpaceId={id}
        showSpace={false}
        filter={(i) => isActive(i) && i.spaceId === id}
        empty={
          <EmptyState icon={<FolderOpen size={22} />} title={`Nothing in ${space.name} yet`}>
            Links, notes and tasks you add here stay together.
          </EmptyState>
        }
      />
      {editing && <SpaceSettings space={space} onClose={() => setEditing(false)} />}
    </>
  );
}
