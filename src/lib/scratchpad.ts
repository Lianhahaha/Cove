import { signal } from '@preact/signals';

const KEY = 'cove-scratchpad-content';

function loadContent(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export const scratchpadText = signal<string>(typeof localStorage === 'undefined' ? '' : loadContent());
export const scratchpadOpen = signal<boolean>(false);

export function setScratchpadText(val: string) {
  scratchpadText.value = val;
  try {
    localStorage.setItem(KEY, val);
  } catch {
    /* storage unavailable */
  }
}

export function openScratchpad() {
  scratchpadOpen.value = true;
}

export function closeScratchpad() {
  scratchpadOpen.value = false;
}

export function clearScratchpad() {
  setScratchpadText('');
}
