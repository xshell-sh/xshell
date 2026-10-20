import { useSyncExternalStore } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

// Whether the app window is on screen: not minimized and not hidden. An unfocused but
// visible window still counts as visible (e.g. watching a session on a second monitor).
// WebView2 doesn't reliably flip document.visibilityState on minimize, so the Tauri
// window's minimized state is checked too, on resize and focus changes.
// One shared listener set for the whole app; components subscribe via useWindowVisible().

let visible = true;
const subscribers = new Set<() => void>();
let started = false;

function setVisible(next: boolean) {
  if (next === visible) return;
  visible = next;
  subscribers.forEach(fn => fn());
}

function start() {
  if (started) return;
  started = true;
  const win = getCurrentWindow();
  const recheck = async () => {
    if (document.visibilityState === "hidden") { setVisible(false); return; }
    try { setVisible(!(await win.isMinimized())); } catch (_) { setVisible(true); }
  };
  document.addEventListener("visibilitychange", recheck);
  win.onResized(recheck).catch(() => {});
  win.onFocusChanged(recheck).catch(() => {});
  recheck();
}

export function isWindowVisible() { return visible; }

export function subscribeWindowVisible(fn: () => void) {
  start();
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

export function useWindowVisible() {
  return useSyncExternalStore(subscribeWindowVisible, isWindowVisible);
}
