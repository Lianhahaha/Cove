import { render } from 'preact';
import { trackHistory } from './lib/nav';
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
import { startPdfQueue } from './lib/pdf-text';
import { loadQuickLinks } from './lib/links';
import { refreshDefaultSpaceIcons } from './lib/spaceIcons';
// Self-hosted variable fonts, so text looks the same offline and nothing loads from a font CDN.
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
// The Cove wordmark only: one Latin italic file.
import '@fontsource/instrument-serif/latin-400-italic.css';
import './styles.css';

// Before the router's first history entry, so every entry is numbered.
trackHistory();
render(<App />, document.getElementById('app')!);
startPwa();
startPreviewQueue();
startReminders();
startFocusClock();
startPdfQueue();
void handleLaunchParams();
void loadAiSettings();
void loadQuickLinks();
void refreshDefaultSpaceIcons();
void getSetting('autoTag', true).then((v) => (autoTagEnabled.value = v));
// Housekeeping: items older than the trash window are deleted for good.
void purgeExpiredTrash().catch((e) => console.error('Trash cleanup failed', e));
