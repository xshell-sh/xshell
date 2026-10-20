import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DevServer } from "../types";

const POLL_MS = 3000;

// Local dev servers (npm run dev, …) running for the given project folders, polled every 3s
// (skipped while the window is hidden). Matching happens in Rust (list_dev_servers). A server shows
// once it has been seen in two polls in a row, which hides helpers that listen for a moment
// during startup. `refresh` re-polls right away, e.g. after stopping a server.
export function useDevServers(projectPaths: string[]): { servers: DevServer[]; refresh: () => void } {
  const [servers, setServers] = useState<DevServer[]>([]);
  const pathsKey = [...new Set(projectPaths.filter(Boolean))].sort().join("\n");
  const pathsRef = useRef<string[]>([]);
  const lastSeenRef = useRef<Set<string>>(new Set());
  pathsRef.current = pathsKey ? pathsKey.split("\n") : [];

  const refresh = useCallback(() => {
    invoke<DevServer[]>("list_dev_servers", { projectPaths: pathsRef.current })
      .then(found => {
        const key = (s: DevServer) => `${s.pid}:${s.port}`;
        const next = found.filter(s => lastSeenRef.current.has(key(s)));
        lastSeenRef.current = new Set(found.map(key));
        setServers(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, POLL_MS);
    return () => window.clearInterval(id);
  }, [pathsKey, refresh]);

  return { servers, refresh };
}

const normPath = (p: string) => p.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();

// Servers relevant to one tab: started by that tab's session, or running inside its project.
export function devServersForTab(servers: DevServer[], tabId: string, projectPath: string | undefined): DevServer[] {
  const root = projectPath ? normPath(projectPath) : "";
  return servers.filter(s => {
    if (s.tab_id === tabId) return true;
    if (!root) return false;
    const cwd = normPath(s.cwd);
    return cwd === root || cwd.startsWith(root + "\\");
  });
}
