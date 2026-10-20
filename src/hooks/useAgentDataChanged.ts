import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useWindowVisible } from "./useWindowVisible";

// Agent tags emitted by the Rust watcher (start_agent_data_watcher in lib.rs).
export type AgentDataTag = "claude" | "claude-stats" | "codex" | "cursor" | "opencode" | "antigravity";

// Calls `onChange` whenever the backend sees agent session data change on disk (throttled
// to one event per ~2s), plus every `fallbackMs` as a safety net for directories the
// watcher couldn't watch (e.g. an agent installed after xshell started). `filter` limits
// which agents' changes trigger a call. While the window is minimized/hidden, calls are
// held back and a single catch-up call runs when it's shown again (if anything changed).
// The handler is kept in a ref, so it can change every render without re-subscribing.
export function useAgentDataChanged(onChange: () => void, opts: { enabled?: boolean; filter?: AgentDataTag[]; fallbackMs?: number } = {}) {
  const { enabled = true, filter, fallbackMs = 60000 } = opts;
  const windowVisible = useWindowVisible();
  const handlerRef = useRef(onChange);
  handlerRef.current = onChange;
  const visibleRef = useRef(windowVisible);
  visibleRef.current = windowVisible;
  const missedRef = useRef(false);
  const filterKey = filter?.join(",") ?? "";

  useEffect(() => {
    if (!enabled) return;
    const tags = filterKey ? filterKey.split(",") : null;
    let disposed = false;
    let unlisten: (() => void) | null = null;
    listen<string[]>("agent-data-changed", ev => {
      if (tags && !ev.payload.some(a => tags.includes(a))) return;
      if (visibleRef.current) handlerRef.current();
      else missedRef.current = true;
    }).then(fn => { if (disposed) fn(); else unlisten = fn; });
    return () => { disposed = true; unlisten?.(); };
  }, [enabled, filterKey]);

  // Fallback poll only while visible; catch up once on becoming visible.
  useEffect(() => {
    if (!enabled || !windowVisible) return;
    if (missedRef.current) { missedRef.current = false; handlerRef.current(); }
    const id = window.setInterval(() => handlerRef.current(), fallbackMs);
    return () => window.clearInterval(id);
  }, [enabled, windowVisible, fallbackMs]);
}
