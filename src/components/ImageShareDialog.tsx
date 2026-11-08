import { useEffect, useRef, useState } from 'react';
import { Download, Images, Loader2, Share2, X } from 'lucide-react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { canShareImageFile, isAppleMobileDevice, type ImageDeliveryIntent } from '../sharing/imageDelivery';
import { imageDeliveryCopy } from '../sharing/imageDeliveryCopy';
import type { Language } from '../translations';

interface Props {
  language: Language;
  intent: ImageDeliveryIntent;
  prepareFile: () => Promise<File>;
  onClose: () => void;
  fallbackImageUrl?: string;
  convertedFromWebp?: boolean;
}

type Preparation =
  | { phase: 'preparing' }
  | { phase: 'error' }
  | { phase: 'ready'; file: File; url: string };

/**
 * Render first, then ask for a second explicit user gesture before calling
 * navigator.share(). iOS Safari may expire transient activation while fonts,
 * background images or Canvas.toBlob are being awaited.
 */
export function ImageShareDialog({
  language, intent, prepareFile, onClose, fallbackImageUrl, convertedFromWebp = false,
}: Props) {
  const copy = imageDeliveryCopy[language];
  const dialogRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const [attempt, setAttempt] = useState(0);
  const [preparation, setPreparation] = useState<Preparation>({ phase: 'preparing' });
  const [sharing, setSharing] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const isAppleMobile = isAppleMobileDevice();

  useDialogA11y({ isOpen: true, dialogRef, onClose });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setPreparation({ phase: 'preparing' });
    setShareFailed(false);
    setSharing(false);

    void prepareFile().then((file) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(file);
      setPreparation({ phase: 'ready', file, url: objectUrl });
    }).catch(() => {
      if (active) setPreparation({ phase: 'error' });
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt, prepareFile]);

  const file = preparation.phase === 'ready' ? preparation.file : null;
  const canShare = file ? canShareImageFile(file) : false;
  const previewUrl = preparation.phase === 'ready' ? preparation.url : fallbackImageUrl;

  const openSystemShare = () => {
    if (!file || !canShare || sharing) return;
    setShareFailed(false);
    let pending: Promise<void>;
    try {
      // CRITICAL: No await or asynchronous image work before this invocation.
      // A tap on this button supplies the short-lived Safari user activation.
      pending = navigator.share({ files: [file] });
    } catch {
      setShareFailed(true);
      return;
    }
    setSharing(true);
    void pending.catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') return;
      if (mountedRef.current) setShareFailed(true);
    }).finally(() => {
      // Older Safari versions can leave share promises pending after Save Image.
      // Closing the dialog must always remain possible.
      if (mountedRef.current) setSharing(false);
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6" role="presentation">
      <button type="button" aria-label={copy.close} onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="image-share-dialog-title"
        aria-describedby="image-share-dialog-description" tabIndex={-1}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] bg-[#fffdf9] text-slate-800 shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
          <div>
            <h2 id="image-share-dialog-title" className="flex items-center gap-2 text-lg font-semibold text-teal-950">
              {intent === 'photos' ? <Images size={21} /> : <Share2 size={21} />}
              {intent === 'photos' ? copy.photosTitle : copy.shareTitle}
            </h2>
            <p id="image-share-dialog-description" className="mt-1 text-sm leading-5 text-slate-600">
              {intent === 'photos' ? copy.photosInstruction : copy.shareInstruction}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={copy.close}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-100">
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {preparation.phase === 'preparing' ? (
            <p role="status" className="flex min-h-24 items-center justify-center gap-2 text-sm text-slate-600">
              <Loader2 size={19} className="animate-spin" />{copy.preparing}
            </p>
          ) : null}
          {preparation.phase === 'error' ? (
            <div role="alert" className="mb-3 space-y-3 text-center text-sm text-red-700">
              <p>{copy.prepareFailed}</p>
              <button type="button" onClick={() => setAttempt((n) => n + 1)}
                className="min-h-11 rounded-xl border border-slate-300 px-5 py-2 font-medium text-slate-800">
                {copy.retry}
              </button>
            </div>
          ) : null}
          {previewUrl ? (
            <div className="mx-auto flex justify-center rounded-xl bg-slate-100/70 p-2">
              <img src={previewUrl} alt={intent === 'photos' ? copy.photosTitle : copy.shareTitle}
                draggable className="max-h-[46dvh] w-auto max-w-full object-contain" />
            </div>
          ) : null}
          {preparation.phase === 'ready' && convertedFromWebp && intent === 'photos' ? (
            <p className="mt-3 text-center text-xs text-slate-500">{copy.webpAsPng}</p>
          ) : null}
          {previewUrl && isAppleMobile ? (
            <p className="mt-3 text-center text-sm text-slate-600">{copy.longPressHint}</p>
          ) : null}
          {preparation.phase === 'ready' && !canShare ? (
            <p className="mt-3 text-center text-sm text-slate-600">{copy.shareUnavailable}</p>
          ) : null}
          {shareFailed ? <p role="alert" className="mt-3 text-center text-sm text-red-700">{copy.shareFailed}</p> : null}
        </div>
        <footer className="shrink-0 space-y-2 border-t border-slate-200/70 bg-white px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {file && canShare ? (
            <button type="button" onClick={openSystemShare} disabled={sharing}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-900 px-4 py-3 font-semibold text-white disabled:opacity-60">
              {sharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
              {sharing ? copy.sharing : copy.openShareSheet}
            </button>
          ) : null}
          {file ? (
            <a href={preparation.phase === 'ready' ? preparation.url : undefined} download={file.name}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
              <Download size={17} />{copy.downloadInstead}
            </a>
          ) : null}
          {intent === 'photos' ? (
            <p className="text-center text-xs text-slate-500">{copy.noSaveConfirmation}</p>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
