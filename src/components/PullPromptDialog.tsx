import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Download, Loader2, AlertTriangle } from "lucide-react";
import type { PullPrompt } from "../hooks/useRemoteCheck";

interface Props { prompt: PullPrompt; remaining: number; onPulled: () => void; onLater: () => void; }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Asks to pull when a project's branch is behind its upstream (commits pushed from another
// computer). Pull runs `git pull --ff-only`; X, backdrop, Esc and Later all mean Later.
export function PullPromptDialog({ prompt, remaining, onPulled, onLater }: Props) {
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { state } = prompt;
  const diverged = state.ahead > 0;

  useEffect(() => { setPulling(false); setError(null); }, [prompt.key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !pulling) onLater(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLater, pulling]);

  const pull = async () => {
    setPulling(true);
    setError(null);
    try {
      await invoke("git_pull", { cwd: prompt.repoPath });
      onPulled();
    } catch (e) {
      setError(String(e));
      setPulling(false);
    }
  };

  const close = () => { if (!pulling) onLater(); };

  return (
    <div className="md-overlay" onClick={close}>
      <div className="md-dialog upd-dialog" onClick={e => e.stopPropagation()}>
        <div className="md-head">
          <span className="md-title">New commits to pull</span>
          <button className="md-head-btn" onClick={close} aria-label="Close"><X size={14} /></button>
        </div>
        <div className="md-body upd-body">
          <div className="upd-summary">
            <strong>{prompt.projectName}{prompt.rel ? ` / ${prompt.rel}` : ""}</strong> is {plural(state.behind, "commit")} behind <strong>{state.upstream}</strong> (branch <strong>{state.branch}</strong>).
          </div>
          {diverged ? (
            <div className="upd-install">
              This branch also has {plural(state.ahead, "local commit")} that {state.ahead === 1 ? "is" : "are"} not pushed, so the histories have diverged. Pull with merge or rebase in the terminal.
            </div>
          ) : state.changed_files > 0 && (
            <div className="upd-install">
              You have {plural(state.changed_files, "uncommitted change")}. Pull works if the new commits don't touch the same files; otherwise git stops and nothing is changed.
            </div>
          )}
          {error && (
            <div className="settings-install-error upd-install-error pull-error">
              <AlertTriangle size={12} />
              <span>{error}</span>
            </div>
          )}
          {state.incoming.length > 0 && (
            <div className="upd-notes">
              <div className="upd-notes-head">Incoming commits{state.behind > state.incoming.length ? ` (latest ${state.incoming.length})` : ""}</div>
              <div className="upd-notes-body pull-commits">
                {state.incoming.map(c => (
                  <div key={c.hash} className="pull-commit">
                    <span className="pull-commit-hash">{c.short_hash}</span>
                    <span className="pull-commit-subject">{c.subject}</span>
                    <span className="pull-commit-meta">{c.author}, {c.relative_time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="upd-foot">
          {remaining > 0 && <span className="pull-remaining">+{remaining} more</span>}
          <div className="upd-foot-spacer" />
          <button className="btn btn-primary" onClick={pull} disabled={pulling || diverged}>
            {pulling ? <><Loader2 size={11} className="settings-spin" /> Pulling…</> : <><Download size={11} /> Pull</>}
          </button>
          <button className="btn btn-ghost" onClick={close} disabled={pulling}>Later</button>
        </div>
      </div>
    </div>
  );
}
