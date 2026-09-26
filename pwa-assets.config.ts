import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Maskable and Apple icons get the brand purple behind them instead of white.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.3, resizeOptions: { background: '#684c96' } },
    apple: { ...minimal2023Preset.apple, padding: 0.3, resizeOptions: { background: '#684c96' } },
  },
  images: ['public/logo.svg'],
});
