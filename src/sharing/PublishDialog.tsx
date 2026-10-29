import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Loader2, Trash2, X } from 'lucide-react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { shareCopy } from './copy';
import { removePublishCredentialsSafely } from './publishProtocol';
import {
  checkLocalShareStatus, listLocalShares, markLocalSharePublished,
  markLocalShareRevokedSafely, type LocalShare,
} from './shareLibrary';
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
  /** Diagnostic status only; never includes a deletion key or server message. */
  failureDetail?: string;
  /** A different canvas cannot safely replay the previous snapshot. */
  pendingChanged?: boolean;
}

interface Props {
  language: Language;
  isOpen: boolean;
  onClose: () => void;
  publish: () => Promise<PublishedShare>;
  initialLibrary?: boolean;
}

export function PublishDialog({ language, isOpen, onClose, publish, initialLibrary = false }: Props) {
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
  const [showLibrary, setShowLibrary] = useState(initialLibrary);
  const [records, setRecords] = useState<LocalShare[]>([]);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryAction, setLibraryAction] = useState('');
  const [libraryError, setLibraryError] = useState('');
  const [exposedKey, setExposedKey] = useState<string | null>(null);
  const libraryLoadRef = useRef(0);

  // A live share without persistent revocation credentials cannot be dismissed
  // accidentally. The user must first confirm an independent backup or revoke.
  const unresolved = !!(result?.recoveryRequired || result?.statusUnknown);
  // Uncertain publications already have a committed IndexedDB owner record.
  // Only failed local publication-state persistence requires external backup.
  const needsBackup = !!result?.recoveryRequired && !backupConfirmed;
  const canClose = !inFlightRef.current && !publishing && !recoveryBusy
    && !libraryAction && !needsBackup;
  const close = () => { if (canClose) onClose(); };
  useDialogA11y({ isOpen, dialogRef, onClose: close });

  useEffect(() => {
    if (isOpen) {
      setShowLibrary(initialLibrary);
    } else {
      setResult(null);
      setRevoked(false);
      setCopied(false);
      setRecoveryCopied(false);
      setBackupConfirmed(false);
      setError('');
      setLibraryError('');
      setExposedKey(null);
    }
  }, [isOpen, initialLibrary]);

  useEffect(() => {
    if (!isOpen || !showLibrary) return;
    const ticket = ++libraryLoadRef.current;
    setLibraryBusy(true);
    setLibraryError('');
    void listLocalShares().then((all) => {
      if (ticket === libraryLoadRef.current) setRecords(all);
    }).catch(() => {
      if (ticket === libraryLoadRef.current) setLibraryError(copy.recoveryStorageUnavailable);
    }).finally(() => {
      if (ticket === libraryLoadRef.current) setLibraryBusy(false);
    });
    return () => { libraryLoadRef.current++; };
  }, [isOpen, showLibrary, copy.recoveryStorageUnavailable]);

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

  const handleRetrySave = async () => {
    if (!result) return;
    if (result.statusUnknown) {
      if (result.pendingChanged) return;
      await handlePublish(); // Reuses the exact IndexedDB ID and content fingerprint.
      return;
    }
    if (!result.recoveryRequired) return;
    try {
      await markLocalSharePublished(result.id, result.deleteToken);
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
      if (!response.ok) throw new Error('HTTP ' + response.status);
      await markLocalShareRevokedSafely(result.id, result.deleteToken);
      removePublishCredentialsSafely(result.id, result.deleteToken);
      setResult(null);
      setRevoked(true);
    } catch (caught) {
      // Never clear the private key after an unconfirmed server response.
      const detail = caught instanceof Error && /^HTTP [1-5][0-9]{2}$/.test(caught.message)
        ? ' (' + caught.message + ')' : '';
      setError(copy.recoveryRevokeFailed + detail);
    } finally {
      setRecoveryBusy(false);
    }
  };

  const refreshRecords = async () => {
    setRecords(await listLocalShares());
  };

  const handleCheckLocal = async (share: LocalShare) => {
    if (libraryAction) return;
    setLibraryAction(share.id);
    setLibraryError('');
    try {
      await checkLocalShareStatus(share);
      await refreshRecords();
    } catch (caught) {
      setLibraryError(caught instanceof Error ? caught.message : copy.loadError);
    } finally {
      setLibraryAction('');
    }
  };

  const handleRemoveLocal = async (share: LocalShare) => {
    if (libraryAction || !window.confirm(copy.revokeConfirm)) return;
    setLibraryAction(share.id);
    setLibraryError('');
    try {
      const response = await fetch('/api/shares/' + encodeURIComponent(share.id), {
        method: 'DELETE', headers: { 'X-Share-Delete-Token': share.deleteToken },
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      await markLocalShareRevokedSafely(share.id, share.deleteToken);
      removePublishCredentialsSafely(share.id, share.deleteToken);
      setRecords((current) => current.filter((item) => item.id !== share.id));
      setExposedKey(null);
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : '';
      setLibraryError(copy.recoveryRevokeFailed + (detail ? ' (' + detail + ')' : ''));
    } finally {
      setLibraryAction('');
    }
  };

  const handleCopyLocal = async (value: string, revealId?: string) => {
    try { await navigator.clipboard.writeText(value); }
    catch {
      // Display the private key only on explicit request when clipboard access
      // is denied. Never append it to a public URL or browser history.
      if (revealId) setExposedKey(revealId);
      else setLibraryError(copy.copyFailed);
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
            {showLibrary ? copy.manageShares
              : revoked ? copy.recoveryRevoked
              : result?.statusUnknown ? copy.pendingTitle
                : result?.recoveryRequired ? copy.recoveryTitle
                : result ? copy.published : copy.publishTitle}
          </h2>
        </div>

        {showLibrary ? (
          <div className="space-y-4">
            <p className="text-xs leading-5 text-(--app-accent-600)">{copy.libraryLocalOnly}</p>
            {libraryBusy ? <p role="status" className="text-sm text-(--app-accent-700)">{copy.loading}</p> : null}
            {libraryError ? <p role="alert" className="text-sm text-red-700">{libraryError}</p> : null}
            {!libraryBusy && records.length === 0 ? (
              <p className="rounded-xl border border-(--app-accent-200) p-4 text-sm text-(--app-accent-700)">{copy.libraryEmpty}</p>
            ) : null}
            <div className="max-h-[50vh] space-y-3 overflow-y-auto">
              {records.map((share) => (
                <div key={share.id} className="space-y-2 rounded-xl border border-(--app-accent-200) bg-white/75 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-medium text-(--app-accent-900)">
                      {share.title || share.id}
                    </p>
                    <span className="shrink-0 text-xs text-(--app-accent-600)">
                      {share.state === 'published' ? copy.libraryPublished
                        : share.state === 'pending' ? copy.libraryPending : copy.libraryUnverified}
                    </span>
                  </div>
                  <a className="block break-all text-xs text-teal-800 underline"
                    href={'/s/' + share.id} target="_blank" rel="noopener noreferrer">
                    {new URL('/s/' + share.id, window.location.origin).toString()}
                  </a>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void handleCopyLocal(new URL('/s/' + share.id, window.location.origin).toString())}
                      className="app-button-secondary rounded-lg px-3 py-2 text-xs">{copy.copy}</button>
                    <button type="button" onClick={() => void handleCopyLocal(share.deleteToken, share.id)}
                      className="app-button-secondary rounded-lg px-3 py-2 text-xs">{copy.recoveryCopy}</button>
                    <button type="button" disabled={!!libraryAction} onClick={() => void handleCheckLocal(share)}
                      className="app-button-secondary rounded-lg px-3 py-2 text-xs disabled:opacity-50">
                      {libraryAction === share.id ? copy.loading : copy.libraryCheck}
                    </button>
                    <button type="button" disabled={!!libraryAction} onClick={() => void handleRemoveLocal(share)}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-800 disabled:opacity-50">{copy.revoke}</button>
                  </div>
                  {exposedKey === share.id ? (
                    <label className="block text-xs text-(--app-accent-700)">
                      {copy.recoveryKey}
                      <input readOnly value={share.deleteToken} aria-label={copy.recoveryKey}
                        onFocus={(event) => event.target.select()}
                        className="mt-1 w-full rounded-lg border border-amber-300 p-2 font-mono text-xs text-slate-900" />
                    </label>
                  ) : null}
                </div>
              ))}
            </div>
            <button type="button" disabled={!!libraryAction}
              onClick={() => { setShowLibrary(false); setLibraryError(''); }}
              className="app-button-primary w-full rounded-xl px-4 py-3 font-semibold disabled:opacity-50">
              {copy.libraryNew}
            </button>
            <button type="button" onClick={close} disabled={!canClose}
              className="block w-full py-2 text-sm text-(--app-accent-700)">{copy.close}</button>
          </div>
        ) : revoked ? (
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
            {result.failureDetail ? (
              <p role="status" className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
                {result.failureDetail}
              </p>
            ) : null}
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
                <button type="button" onClick={() => void handleRetrySave()} disabled={recoveryBusy || publishing}
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
            <button type="button" onClick={() => setShowLibrary(true)}
              className="app-button-secondary w-full rounded-xl px-4 py-3 text-sm font-semibold">{copy.manageShares}</button>
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
