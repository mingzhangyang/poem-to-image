import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Loader2, X } from 'lucide-react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { shareCopy } from './copy';
import type { Language } from '../translations';

export interface PublishedShare { id: string; url: string; deleteToken: string }
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
  const inFlightRef = useRef(false);
  const [result, setResult] = useState<PublishedShare | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const close = () => { if (!inFlightRef.current) onClose(); };
  useDialogA11y({ isOpen, dialogRef, onClose: close });
  useEffect(() => {
    if (!isOpen) { setResult(null); setCopied(false); setError(''); }
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
        : code === 'PAYLOAD_TOO_LARGE' || code === 'IMAGE_TOO_LARGE' ? copy.sizeError : copy.publishError);
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
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={close} aria-label={copy.close} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title" tabIndex={-1}
        className="relative z-10 w-full max-w-lg rounded-3xl border border-white/70 bg-[var(--app-surface)] p-6 shadow-2xl sm:p-8">
        <button type="button" onClick={close} disabled={publishing} aria-label={copy.close}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"><X size={20} /></button>
        <div className="mb-5 flex items-center gap-3 text-(--app-accent-800)">
          <span className="rounded-2xl bg-(--app-accent-50) p-3"><Link2 size={22} /></span>
          <h2 id="publish-dialog-title" className="pr-9 text-xl font-semibold">{result ? copy.published : copy.publishTitle}</h2>
        </div>
        {result ? (
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
            <button type="button" onClick={close} className="block w-full rounded-xl py-2 text-sm text-(--app-accent-700)">{copy.close}</button>
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
