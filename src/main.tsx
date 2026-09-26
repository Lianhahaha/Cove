import { render } from 'preact';
import { App } from './app';
import { startPreviewQueue } from './lib/previews';
import { startPwa } from './lib/pwa';
import { purgeExpiredTrash } from './lib/repo';
import { startReminders } from './lib/reminders';
import { handleLaunchParams } from './lib/share';
import { loadAiSettings } from './lib/ai';
import { autoTagEnabled } from './lib/actions';
import { getSetting } from './lib/repo';
import { startFocusClock } from './lib/focus';
import './styles.css';

render(<App />, document.getElementById('app')!);
startPwa();
startPreviewQueue();
startReminders();
startFocusClock();
void handleLaunchParams();
void loadAiSettings();
void getSetting('autoTag', true).then((v) => (autoTagEnabled.value = v));
// Housekeeping: items older than the trash window are deleted for good.
void purgeExpiredTrash().catch((e) => console.error('Trash cleanup failed', e));
