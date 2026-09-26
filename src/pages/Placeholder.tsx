import { Sparkles } from 'lucide-preact';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

/** Temporary page for routes that are wired up before their screen is built. */
export function Placeholder({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={<Sparkles size={22} />} title={`${title} is on its way`} />
    </>
  );
}
