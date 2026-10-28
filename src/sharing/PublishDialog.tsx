import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Loader2, Trash2, X } from 'lucide-react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { SHARE_OWNER_KEY_PREFIX, shareCopy } from './copy';
import { removePublishCredentials } from './publishProtocol';
import type { Language } from '../translations';

export interface PublishedShare {
  id: string;
  url: string;
  deleteToken: string;
  /** Set when the public share is live but saving its revocation token failed
   * and a best-effort automatic rollback did not confirm removal. */
  recoveryRequired?: boolean;
  /** A request may have committed even though the response was lost.
   * Keep the pre-persisted ID and deletion capability and retry idempotently. */
  statusUnknown?: boolean;
  /** A different canvas cannot safely replay the previous snapshot. */
  pendingChanged?: boolean;
}

interface Props {
  language: Language;
  isOpen: boolean;
  onClose: () => void;
  publish: () => Promise<PublishedShare>;
}

export function PublishDialog({ language, isOpen, onClose, publish }: Props) {
  const copy = shareCopy[language];
  const dialogRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const recoveryKeyRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  const [result, setResult] = useState<PublishedShare | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [error, setError] = useState('');

  // A live share without persistent revocation credentials cannot be dismissed
  // accidentally. The user must first confirm an independent backup or revoke.
  const unresolved = !!(result?.recoveryRequired || result?.statusUnknown);
  const needsBackup = unresolved && !backupConfirmed;
  const canClose = !inFlightRef.current && !publishing && !recoveryBusy && !needsBackup;
  const close = () => { if (canClose) onClose(); };
  useDialogA11y({ isOpen, dialogRef, onClose: close });

  useEffect(() => {
    if (!isOpen) {
      setResult(null);
      setRevoked(false);
      setCopied(false);
      setRecoveryCopied(false);
      setBackupConfirmed(false);
      setError('');
    }
  }, [isOpen]);

  const handlePublish = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPublishing(true);
    setError('');
    try {
      setResult(await publish());
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : '';
      setError(code === 'RATE_LIMITED' ? copy.limitError
        : code === 'PAYLOAD_TOO_LARGE' || code === 'IMAGE_TOO_LARGE' ? copy.sizeError
          : code === 'STORAGE_UNAVAILABLE' ? copy.recoveryStorageUnavailable
            : code === 'STORAGE_UNAVAILABLE_REVOKED' ? copy.recoveryStorageRolledBack
              : copy.publishError);
    } finally {
      inFlightRef.current = false;
      setPublishing(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
    } catch {
      urlRef.current?.focus();
      urlRef.current?.select();
    }
  };

  const handleCopyRecovery = async () => {
    if (!unresolved || !result) return;
    try {
      // The token must NEVER be appended to a public link or shared via
      // navigator.share. Clipboard access is explicit and user-initiated.
      await navigator.clipboard.writeText(result.deleteToken);
      setRecoveryCopied(true);
    } catch {
      recoveryKeyRef.current?.focus();
      recoveryKeyRef.current?.select();
    }
  };

  const handleRetrySave = () => {
    if (!result) return;
    if (result.statusUnknown) {
      if (result.pendingChanged) return;
      void handlePublish(); // Uses the pre-persisted ID/token; never republishes another ID.
      return;
    }
    if (!result.recoveryRequired) return;
    try {
      const key = SHARE_OWNER_KEY_PREFIX + result.id;
      localStorage.setItem(key, result.deleteToken);
      if (localStorage.getItem(key) !== result.deleteToken) throw new Error('UNSAVED');
      setResult({ ...result, recoveryRequired: false });
      setError('');
    } catch {
      setError(copy.recoveryRetryFailed);
    }
  };

  const handleRevoke = async () => {
    if (!unresolved || !result || recoveryBusy) return;
    setRecoveryBusy(true);
    setError('');
    try {
      const response = await fetch('/api/shares/' + encodeURIComponent(result.id), {
        method: 'DELETE',
        headers: { 'X-Share-Delete-Token': result.deleteToken },
      });
      if (!response.ok) throw new Error('REVOKE_FAILED');
      removePublishCredentials(localStorage, result.id, result.deleteToken);
      setResult(null);
      setRevoked(true);
    } catch {
      // Retain the private capability in the dialog for another attempt.
      setError(copy.recoveryRevokeFailed);
    } finally {
      setRecoveryBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8">
      <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={close} aria-label={copy.close} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title" tabIndex={-1}
        className="relative z-10 my-auto w-full max-w-lg rounded-3xl border border-white/70 bg-[var(--app-surface)] p-6 shadow-2xl sm:p-8">
        <button type="button" onClick={close} disabled={!canClose} aria-label={copy.close}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
          <X size={20} />
        </button>
        <div className="mb-5 flex items-center gap-3 text-(--app-accent-800)">
          <span className="rounded-2xl bg-(--app-accent-50) p-3"><Link2 size={22} /></span>
          <h2 id="publish-dialog-title" className="pr-9 text-xl font-semibold">
            {revoked ? copy.recoveryRevoked
              : result?.statusUnknown ? copy.pendingTitle
                : result?.recoveryRequired ? copy.recoveryTitle
                : result ? copy.published : copy.publishTitle}
          </h2>
        </div>

        {revoked ? (
          <div className="space-y-5">
            <p role="status" className="text-sm text-(--app-accent-700)">{copy.recoveryRevoked}</p>
            <button type="button" onClick={close}
              className="app-button-primary w-full rounded-xl px-4 py-3 font-semibold">{copy.close}</button>
          </div>
        ) : unresolved && result ? (
          <div className="space-y-4">
            <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              {result.pendingChanged ? copy.pendingChangedWarning
                : result.statusUnknown ? copy.pendingWarning : copy.recoveryWarning}
            </p>
            <p className="break-all text-sm text-(--app-accent-700)">{result.url}</p>
            <label className="block space-y-2 text-sm font-semibold text-(--app-accent-800)">
              <span>{copy.recoveryKey}</span>
              <input ref={recoveryKeyRef} readOnly value={result.deleteToken} onFocus={(event) => event.target.select()}
                aria-label={copy.recoveryKey} autoComplete="off" spellCheck={false}
                className="w-full rounded-xl border border-amber-300 bg-white px-3 py-3 font-mono text-xs font-normal text-slate-900" />
            </label>
            <button type="button" onClick={() => void handleCopyRecovery()} disabled={recoveryBusy}
              className="app-button-secondary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium disabled:opacity-50">
              {recoveryCopied ? <Check size={17} /> : <Copy size={17} />}
              {recoveryCopied ? copy.recoveryCopied : copy.recoveryCopy}
            </button>
            {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {!result.pendingChanged ? (
                <button type="button" onClick={handleRetrySave} disabled={recoveryBusy || publishing}
                  className="app-button-secondary rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50">
                  {publishing ? copy.publishing : result.statusUnknown ? copy.pendingRetry : copy.recoveryRetry}
                </button>
              ) : null}
              <button type="button" onClick={() => void handleRevoke()} disabled={recoveryBusy || publishing}
                className="flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-3 text-sm font-semibold text-red-800 disabled:opacity-50">
                {recoveryBusy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {copy.recoveryRevoke}
              </button>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-(--app-accent-200) px-3 py-3 text-sm text-(--app-accent-800)">
              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0"
                checked={backupConfirmed} onChange={(event) => setBackupConfirmed(event.target.checked)} />
              <span>{copy.recoverySavedConfirm}</span>
            </label>
            <button type="button" onClick={close} disabled={!canClose}
              className="app-button-primary w-full rounded-xl px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50">
              {copy.close}
            </button>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <p className="text-sm text-(--app-accent-700)">{copy.linkHint}</p>
            <div className="flex items-center gap-2">
              <input ref={urlRef} aria-label={copy.copy} readOnly value={result.url} onFocus={(event) => event.target.select()}
                className="min-w-0 flex-1 rounded-xl border border-(--app-accent-200) bg-white/80 px-3 py-3 text-sm text-(--app-accent-900)" />
              <button type="button" onClick={() => void handleCopy()}
                className="app-button-primary flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
                {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? copy.copied : copy.copy}
              </button>
            </div>
            <p className="text-xs leading-5 text-(--app-accent-600)">{copy.localManage}</p>
            <a href={result.url} target="_blank" rel="noopener noreferrer"
              className="app-button-secondary flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold">
              <ExternalLink size={17} />{copy.view}
            </a>
            <button type="button" onClick={close} className="block w-full rounded-xl py-2 text-sm text-(--app-accent-700)">
              {copy.close}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm leading-6 text-(--app-accent-700)">{copy.publishDescription}</p>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{copy.publishWarning}</p>
            {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
            <button type="button" onClick={() => void handlePublish()} disabled={publishing}
              className="app-button-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold disabled:opacity-60">
              {publishing ? <Loader2 className="animate-spin" size={17} /> : <Link2 size={17} />}
              {publishing ? copy.publishing : copy.publish}
            </button>
            <button type="button" onClick={close} disabled={publishing}
              className="block w-full rounded-xl py-2 text-sm text-(--app-accent-700) disabled:opacity-50">{copy.cancel}</button>
          </div>
        )}
      </div>
    </div>
  );
}
