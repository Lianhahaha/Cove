import { Compass } from 'lucide-preact';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

export function NotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <EmptyState icon={<Compass size={22} />} title="This page doesn't exist">
        <a class="text-accent underline" href="/">Go home</a>
      </EmptyState>
    </>
  );
}
