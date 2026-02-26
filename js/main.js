/**
 * ZenTree Tabs - Side Panel Entry
 * Creates state and storage, then runs init.
 */
import { TabState } from './state.js';
import { Storage } from './storage.js';
import { init } from '../sidepanel.js';

const state = new TabState();
const storage = new Storage();

document.addEventListener('DOMContentLoaded', () => {
  init(state, storage);
});
