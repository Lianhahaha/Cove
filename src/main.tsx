import { render } from 'preact';
import { App } from './app';
import { startPreviewQueue } from './lib/previews';
import { startPwa } from './lib/pwa';
import './styles.css';

render(<App />, document.getElementById('app')!);
startPwa();
startPreviewQueue();
