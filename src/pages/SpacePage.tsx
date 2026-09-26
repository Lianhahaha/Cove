import { FolderOpen } from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { isActive } from '../lib/queries';
import { ItemsView } from '../components/ItemsView';
import { EmptyState } from '../components/EmptyState';
import { NotFound } from './NotFound';

export function SpacePage({ id }: { id: string }) {
  const space = useLive(() => db.spaces.get(id), [id]);
  if (space === undefined) return null;
  if (!space || space.deletedAt) return <NotFound />;
  return (
    <ItemsView
      title={
        <span class="flex items-center gap-2">
          <span>{space.emoji}</span>
          {space.name}
        </span>
      }
      prefKey="space"
      deps={[id]}
      defaultSpaceId={id}
      showSpace={false}
      filter={(i) => isActive(i) && i.spaceId === id}
      empty={
        <EmptyState icon={<FolderOpen size={22} />} title={`Nothing in ${space.name} yet`}>
          Links, notes and tasks you add here stay together.
        </EmptyState>
      }
    />
  );
}
