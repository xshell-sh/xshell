import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GitRemoteState, Tab } from "../types";

// A new tab re-checks its project only if the last check is older than this.
const RECHECK_MS = 5 * 60_000;
// Open projects are re-checked this often while the window is on screen.
const POLL_MS = 15 * 60_000;

export interface PullPrompt {
  key: string;         // repo path + upstream commit; "Later" hides the prompt until the upstream moves
  projectName: string;
  repoPath: string;
  rel: string;         // repo folder relative to the project; always "" (the project folder itself) for now
  state: GitRemoteState;
}

const normPath = (p: string) => p.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
const baseName = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p;

// Fetches the projects open in tabs (on launch, when a tab opens a project, and every POLL_MS)
// and queues a prompt for each one whose branch is behind its upstream, e.g. after commits were
// pushed from another computer. Fetches run one at a time in the background.
export function useRemoteCheck(tabs: Tab[]) {
  const [prompts, setPrompts] = useState<PullPrompt[]>([]);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const lastCheckRef = useRef(new Map<string, number>()); // normalized project path -> ms
  const seenTabsRef = useRef(new Set<string>());
  const declinedRef = useRef(new Set<string>());
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const check = useCallback((projectPath: string, projectName: string) => {
    lastCheckRef.current.set(normPath(projectPath), Date.now());
    queueRef.current = queueRef.current.then(async () => {
      const state = await invoke<GitRemoteState | null>("git_fetch_remote", { cwd: projectPath }).catch(() => null);
      if (!state || state.behind === 0) return;
      const key = `${normPath(projectPath)}|${state.upstream_hash}`;
      if (declinedRef.current.has(key)) return;
      const prompt: PullPrompt = { key, projectName, repoPath: projectPath, rel: "", state };
      setPrompts(prev => {
        const i = prev.findIndex(p => normPath(p.repoPath) === normPath(projectPath));
        if (i < 0) return [...prev, prompt];
        const next = prev.slice();
        next[i] = prompt;
        return next;
      });
    });
  }, []);

  useEffect(() => {
    for (const t of tabs) {
      if (t.type !== "terminal" || !t.projectPath || seenTabsRef.current.has(t.id)) continue;
      seenTabsRef.current.add(t.id);
      const last = lastCheckRef.current.get(normPath(t.projectPath));
      if (last == null || Date.now() - last > RECHECK_MS) check(t.projectPath, t.projectName || baseName(t.projectPath));
    }
  }, [tabs, check]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      for (const t of tabsRef.current) {
        if (t.type !== "terminal" || !t.projectPath) continue;
        const last = lastCheckRef.current.get(normPath(t.projectPath)) ?? 0;
        if (Date.now() - last >= POLL_MS) check(t.projectPath, t.projectName || baseName(t.projectPath));
      }
    }, 60_000);
    return () => window.clearInterval(id);
  }, [check]);

  // "Later": don't ask again about these commits; a newer push asks again.
  const decline = useCallback((key: string) => {
    declinedRef.current.add(key);
    setPrompts(prev => prev.filter(p => p.key !== key));
  }, []);
  const resolve = useCallback((key: string) => {
    setPrompts(prev => prev.filter(p => p.key !== key));
  }, []);

  return { prompts, decline, resolve };
}
