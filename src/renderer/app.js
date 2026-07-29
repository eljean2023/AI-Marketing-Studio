import { renderHomeMenu } from './components/home-menu/home-menu.js';
import { startRecordFlow } from './flows/record-flow.js';
import { startSnipFlow } from './flows/snip-flow.js';
import { startShortsFlow } from './flows/shorts-flow.js';
import { startBrandFlow } from './flows/brand-flow.js';
import { startCopywriterFlow } from './flows/copywriter-flow.js';
import { startSpotFlow } from './flows/spot-flow.js';
import { MODULE_REGISTRY } from '../shared/module-registry.js';

const appEl = document.getElementById('app');

const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.webm'];

const HOME_LOGO = MODULE_REGISTRY.find((module) => module.id === 'recorder').icon;

// Tracks the currently mounted Snipping Tool flow instance (if any), so
// global triggers -- drag & drop, the Ctrl+O shortcut -- can hand a file to
// an already-open flow instead of always mounting a fresh one.
let activeSnipHandle = null;

// One entry per *enabled* module in the registry. A module with no entry
// here still renders on the Home Screen (via MODULE_REGISTRY) but as a
// disabled "Coming Soon" card, since it has no flow to start yet.
const FLOW_STARTERS = {
  recorder: () => {
    activeSnipHandle = null;
    startRecordFlow(appEl, { onExit: renderHome });
  },
  snip: () => {
    activeSnipHandle = startSnipFlow(appEl, { onExit: renderHome });
  },
  shorts: () => {
    activeSnipHandle = null;
    startShortsFlow(appEl, { onExit: renderHome });
  },
  brand: () => {
    activeSnipHandle = null;
    startBrandFlow(appEl, { onExit: renderHome });
  },
  copywriter: () => {
    activeSnipHandle = null;
    startCopywriterFlow(appEl, { onExit: renderHome });
  },
  spots: () => {
    activeSnipHandle = null;
    startSpotFlow(appEl, { onExit: renderHome });
  },
};

function renderHome() {
  activeSnipHandle = null;

  const workflows = MODULE_REGISTRY.map((module) => ({
    icon: module.icon,
    tag: module.tag,
    accent: module.accent,
    title: module.title,
    description: module.description,
    disabled: !module.enabled,
    badge: module.comingSoon ? 'Coming Soon' : undefined,
    onSelect: FLOW_STARTERS[module.id],
  }));

  renderHomeMenu(appEl, {
    logo: HOME_LOGO,
    title: 'Demo Recorder Studio',
    subtitle: 'Professional Demo Video Creator',
    workflows,
  });
}

function isSupportedVideoFile(filePath) {
  const lower = filePath.toLowerCase();
  return SUPPORTED_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function openPathInSnipFlow(filePath) {
  if (activeSnipHandle) {
    activeSnipHandle.requestOpenFile(filePath);
  } else {
    activeSnipHandle = startSnipFlow(appEl, { onExit: renderHome, initialFilePath: filePath });
  }
}

// --- Drag & drop: works anywhere in the window, always routes into the
// Snipping Tool. Ignored while a recording is in progress, so an accidental
// drop can't interrupt an active capture. ---

window.addEventListener('dragover', (event) => {
  event.preventDefault();
});

window.addEventListener('drop', (event) => {
  event.preventDefault();

  const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
  if (!file || !file.path || !isSupportedVideoFile(file.path)) return;

  openPathInSnipFlow(file.path);
});

// --- Global keyboard shortcuts ---

window.addEventListener('keydown', (event) => {
  const isTypingTarget = event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA');
  if (isTypingTarget) return;

  const ctrlOrCmd = event.ctrlKey || event.metaKey;

  if (ctrlOrCmd && event.key.toLowerCase() === 'o') {
    event.preventDefault();

    if (activeSnipHandle) {
      activeSnipHandle.requestOpenDialog();
    } else {
      activeSnipHandle = startSnipFlow(appEl, { onExit: renderHome });
      activeSnipHandle.requestOpenDialog();
    }
  }
});

renderHome();
