import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Loader2, Share2, Trash2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { readPreferredLanguage } from '../hooks/useLang';
import { SHARE_OWNER_KEY_PREFIX, shareCopy } from '../sharing/copy';

interface PublicArtwork {
  id: string; title: string; author: string; createdAt: string;
  url: string; imageUrl: string; cardUrl: string;
}

export default function ShareViewerPage() {
  const { id = '' } = useParams();
  const copy = shareCopy[readPreferredLanguage()];
  const [artwork, setArtwork] = useState<PublicArtwork | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState('');
  const [deleteToken, setDeleteToken] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const linkRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setNotFound(false); setArtwork(null); setError(''); setManualToken('');
    try { setDeleteToken(localStorage.getItem(SHARE_OWNER_KEY_PREFIX + id)); }
    catch { setDeleteToken(null); }
    void fetch('/api/shares/' + encodeURIComponent(id), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<PublicArtwork>;
      })
      .then((value) => { if (!controller.signal.aborted) setArtwork(value); })
      .catch(() => { if (!controller.signal.aborted) setNotFound(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  const handleCopy = async () => {
    if (!artwork) return;
    try { await navigator.clipboard.writeText(artwork.url); setCopied(true); }
    catch { linkRef.current?.focus(); linkRef.current?.select(); }
  };
  const handleShare = async () => {
    if (!artwork) return;
    if (typeof navigator.share !== 'function') { await handleCopy(); return; }
    try { await navigator.share({ title: artwork.title, url: artwork.url }); }
    catch { /* Cancelling the share sheet is not an error. */ }
  };
  const handleRevoke = async () => {
    const token = deleteToken ?? manualToken.trim();
    if (!/^[a-f0-9]{64}$/.test(token) || !artwork || revoking || !window.confirm(copy.revokeConfirm)) return;
    setRevoking(true); setError('');
    try {
      const response = await fetch('/api/shares/' + artwork.id, {
        method: 'DELETE', headers: { 'X-Share-Delete-Token': token },
      });
      if (!response.ok) throw new Error('Revoke failed');
      try { localStorage.removeItem(SHARE_OWNER_KEY_PREFIX + artwork.id); } catch { /* storage denied */ }
      setDeleteToken(null); setManualToken(''); setArtwork(null); setNotFound(true);
    } catch { setError(copy.revokeError); }
    finally { setRevoking(false); }
  };

  return (
    <div className="min-h-dvh bg-[#f7f4ed] text-slate-800">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-8">
        <a href="/" className="text-xl font-semibold tracking-tight text-teal-900">InkPoem</a>
        <a href="/" className="rounded-xl bg-teal-900 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">{copy.create}</a>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-16 pt-4 sm:px-8">
        {loading ? (
          <div role="status" className="flex min-h-96 items-center gap-2 text-slate-600"><Loader2 size={20} className="animate-spin" />{copy.loading}</div>
        ) : notFound || !artwork ? (
          <div className="flex min-h-96 flex-col items-center justify-center gap-3 text-center">
            <h1 className="text-2xl font-semibold">{copy.linkUnavailable}</h1>
            <p className="max-w-md text-slate-600">{copy.linkUnavailableHint}</p>
            <a href="/" className="mt-4 text-teal-800 underline">{copy.create}</a>
          </div>
        ) : (
          <>
            <h1 className="mb-2 max-w-3xl text-center text-2xl font-semibold sm:text-3xl">{artwork.title}</h1>
            {artwork.author ? <p className="mb-6 text-center text-sm text-slate-600">{artwork.author}</p> : <div className="mb-5" />}
            <img src={artwork.imageUrl} alt={artwork.title}
              className="max-h-[78vh] max-w-full rounded-sm bg-white object-contain shadow-[0_16px_60px_rgba(17,42,40,0.16)]" />
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href={artwork.imageUrl} download={artwork.title + (artwork.imageUrl.endsWith('.png') ? '.png' : '.jpg')}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
                <Download size={17} />{copy.download}
              </a>
              <button type="button" onClick={() => void handleShare()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-900 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
                <Share2 size={17} />{copy.share}
              </button>
              <button type="button" onClick={() => void handleCopy()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
                {copied ? <Check size={17} /> : <Copy size={17} />}{copied ? copy.copied : copy.copy}
              </button>
            </div>
            <input ref={linkRef} readOnly value={artwork.url} aria-label={copy.copy}
              onFocus={(event) => event.target.select()} className="mt-4 w-full max-w-md rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-center text-xs text-slate-600" />
            <div className="mt-10 w-full max-w-md text-center">
              {!deleteToken ? (
                <details className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-left">
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">
                    {copy.recoveryPaste}
                  </summary>
                  <label className="mt-3 block text-xs text-slate-600">
                    {copy.recoveryKey}
                    <input type="password" value={manualToken} autoComplete="off" spellCheck={false}
                      onChange={(event) => setManualToken(event.target.value)}
                      placeholder={copy.recoveryPastePlaceholder}
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900" />
                  </label>
                  <p className="mt-2 text-xs text-slate-500">{copy.recoveryKey}</p>
                </details>
              ) : null}
              {deleteToken || /^[a-f0-9]{64}$/.test(manualToken.trim()) ? (
                <button type="button" onClick={() => void handleRevoke()} disabled={revoking}
                  className="mt-4 inline-flex items-center gap-2 text-xs text-red-700 underline disabled:opacity-50">
                  {revoking ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {revoking ? copy.revoking : copy.revoke}
                </button>
              ) : null}
              {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
            </div>
            <a href="/" className="mt-12 inline-flex items-center gap-2 text-sm text-teal-900 underline">
              {copy.poweredBy}<ExternalLink size={14} />
            </a>
          </>
        )}
      </main>
    </div>
  );
}
