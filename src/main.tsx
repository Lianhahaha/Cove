import { render } from 'preact';
import { App } from './app';
import { startPreviewQueue } from './lib/previews';
import { startPwa } from './lib/pwa';
import { purgeExpiredTrash } from './lib/repo';
import { startReminders } from './lib/reminders';
import './styles.css';

render(<App />, document.getElementById('app')!);
startPwa();
startPreviewQueue();
startReminders();
// Housekeeping: items older than the trash window are deleted for good.
void purgeExpiredTrash().catch((e) => console.error('Trash cleanup failed', e));
