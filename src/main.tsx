import { render } from 'preact';
import { App } from './app';
import { startPreviewQueue } from './lib/previews';
import './styles.css';

render(<App />, document.getElementById('app')!);
startPreviewQueue();
