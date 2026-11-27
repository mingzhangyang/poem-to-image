import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { useAppAuth } from '../context/auth';
import type { Language } from '../translations';
import {
  claimShares, fetchAccountShares, requestGalleryListing, revokeAccountShare, withdrawGalleryListing,
  type AccountShare,
} from './accountSharesApi';
import { shareCopy } from './copy';
import { galleryCopy } from './galleryCopy';
import { removePublishCredentialsSafely } from './publishProtocol';
import { listLocalShares, markLocalShareRevokedSafely, type LocalShare } from './shareLibrary';

interface Props {
  language: Language;
  /** Reports which share IDs belong to the account, so callers can hide them from local lists. */
  onAccountIds?: (ids: ReadonlySet<string>) => void;
  /** Disables actions while the caller is busy. */
  disabled?: boolean;
  headingClassName?: string;
}

function formatDate(value: string, language: Language): string {
  const date = new Date(value.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(language, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Shares owned by the signed-in account, manageable from any device without
 * removal keys. Also offers to add shares this browser published anonymously.
 */
export function AccountShareList({
  language, onAccountIds, disabled = false,
  headingClassName = 'text-sm font-semibold text-(--app-accent-900)',
}: Props) {
  const { isSignedIn, userId, getToken } = useAppAuth();
  const copy = shareCopy[language];
  const gallery = galleryCopy[language];
  const [shares, setShares] = useState<AccountShare[] | null>(null);
  const [unclaimed, setUnclaimed] = useState<LocalShare[]>([]);
  const [localById, setLocalById] = useState<Map<string, LocalShare>>(new Map());
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const loadTicket = useRef(0);
  const onAccountIdsRef = useRef(onAccountIds);
  useEffect(() => { onAccountIdsRef.current = onAccountIds; }, [onAccountIds]);

  const load = useCallback(async () => {
    const ticket = ++loadTicket.current;
    setLoadFailed(false);
    try {
      const [remote, local] = await Promise.all([
        fetchAccountShares(getToken),
        listLocalShares().catch(() => [] as LocalShare[]),
      ]);
      if (ticket !== loadTicket.current) return;
      const ids = new Set(remote.map((share) => share.id));
      setShares(remote);
      setLocalById(new Map(local.map((share) => [share.id, share])));
      setUnclaimed(local.filter((share) => share.state === 'published' && !ids.has(share.id)));
      onAccountIdsRef.current?.(ids);
    } catch {
      if (ticket === loadTicket.current) setLoadFailed(true);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn) return;
    setShares(null);
    void load();
    // Not a DOM ref: bumping the ticket discards a load that finishes after unmount.
    const tickets = loadTicket;
    return () => { tickets.current++; };
  }, [isSignedIn, userId, load]);

  if (!isSignedIn) return null;

  const run = async (id: string, action: () => Promise<void>, failure: string) => {
    if (busy || disabled) return;
    setBusy(id);
    setError('');
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error && caught.message === 'NOT_PERMANENT' ? gallery.needsPermanent : failure);
    } finally {
      setBusy('');
    }
  };

  const claimAll = () => run('claim', async () => {
    await claimShares(getToken, unclaimed);
    await load();
  }, gallery.claimFailed);

  const revoke = (share: AccountShare) => {
    if (!window.confirm(copy.revokeConfirm)) return;
    void run(share.id, async () => {
      await revokeAccountShare(getToken, share.id);
      // Retire this browser's copy of the key too, so it is not offered again.
      const local = localById.get(share.id);
      if (local) {
        await markLocalShareRevokedSafely(share.id, local.deleteToken);
        removePublishCredentialsSafely(share.id, local.deleteToken);
      }
      setShares((current) => current?.filter((item) => item.id !== share.id) ?? null);
    }, copy.revokeError);
  };

  const toggleGallery = (share: AccountShare) => void run(share.id, async () => {
    const inGallery = share.galleryStatus === 'pending' || share.galleryStatus === 'listed';
    const status = inGallery
      ? await withdrawGalleryListing(getToken, share.id)
      : await requestGalleryListing(getToken, share.id);
    setShares((current) => current?.map((item) => (item.id === share.id ? { ...item, galleryStatus: status } : item)) ?? null);
  }, gallery.actionFailed);

  const copyLink = async (share: AccountShare) => {
    try {
      await navigator.clipboard.writeText(new URL(share.url, window.location.origin).toString());
      setCopiedId(share.id);
    } catch {
      setError(copy.copyFailed);
    }
  };

  return (
    <section className="space-y-3" aria-labelledby="account-shares-title">
      <h3 id="account-shares-title" className={headingClassName}>{gallery.accountTitle}</h3>
      {unclaimed.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-(--app-accent-200) bg-(--app-accent-50) p-3 text-sm text-(--app-accent-800)">
          <p>{gallery.claimBanner.replace('{count}', String(unclaimed.length))}</p>
          <button type="button" onClick={() => void claimAll()} disabled={!!busy || disabled}
            className="app-button-secondary rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50">
            {busy === 'claim' ? gallery.loading : gallery.claimButton}
          </button>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {loadFailed ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <span>{gallery.accountLoadError}</span>
          <button type="button" onClick={() => void load()} className="shrink-0 underline">{gallery.retry}</button>
        </div>
      ) : shares === null ? (
        <p role="status" className="flex items-center gap-2 text-sm text-(--app-accent-700)">
          <Loader2 size={15} className="animate-spin" />{gallery.loading}
        </p>
      ) : shares.length === 0 ? (
        <p className="rounded-xl border border-(--app-accent-200) p-4 text-sm text-(--app-accent-700)">{gallery.accountEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {shares.map((share) => {
            const inGallery = share.galleryStatus === 'pending' || share.galleryStatus === 'listed';
            return (
              <li key={share.id} className="space-y-2.5 rounded-xl border border-(--app-accent-200) bg-white/75 p-3">
                <div className="flex items-center gap-3">
                  <a href={share.url} target="_blank" rel="noopener noreferrer"
                    className="block w-20 shrink-0 overflow-hidden rounded-md bg-white sm:w-28">
                    <img src={share.cardUrl} alt="" loading="lazy" width={1200} height={630} className="aspect-[1200/630] w-full object-cover" />
                  </a>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-(--app-accent-900)">{share.title || gallery.untitled}</p>
                    <p className="text-xs text-(--app-accent-600)">
                      {formatDate(share.publishedAt, language)} · {share.permanent || !share.expiresAt
                        ? gallery.permanent : gallery.expiresOn.replace('{date}', formatDate(share.expiresAt, language))}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={share.url} target="_blank" rel="noopener noreferrer"
                    className="app-button-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs">
                    <ExternalLink size={13} />{copy.view}
                  </a>
                  <button type="button" onClick={() => void copyLink(share)}
                    className="app-button-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs">
                    {copiedId === share.id ? <Check size={13} /> : <Copy size={13} />}
                    {copiedId === share.id ? copy.copied : copy.copy}
                  </button>
                  <button type="button" onClick={() => revoke(share)} disabled={!!busy || disabled}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-800 disabled:opacity-50">
                    <Trash2 size={13} />{busy === share.id ? copy.revoking : copy.revoke}
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-(--app-accent-50) px-2.5 py-1.5 text-xs text-(--app-accent-800)">
                  <span>{gallery.label}: {share.permanent ? gallery.status[share.galleryStatus] : gallery.notEligible}</span>
                  {share.permanent && share.galleryStatus !== 'rejected' ? (
                    <button type="button" onClick={() => toggleGallery(share)} disabled={!!busy || disabled}
                      className="app-button-secondary rounded-lg px-2.5 py-1 text-xs disabled:opacity-50">
                      {busy === share.id ? gallery.loading : inGallery ? gallery.withdraw : gallery.request}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
