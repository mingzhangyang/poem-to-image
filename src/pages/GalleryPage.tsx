import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { readPreferredLanguage } from '../hooks/useLang';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { fetchGalleryPage, type GalleryItem } from '../sharing/galleryApi';
import { galleryCopy } from '../sharing/galleryCopy';

export default function GalleryPage() {
  const copy = galleryCopy[readPreferredLanguage()];
  usePageMetadata({
    title: copy.title + ' · InkPoem',
    description: copy.intro,
    canonical: 'https://inkpoem.com/gallery',
    ogTitle: copy.title + ' · InkPoem',
    ogDescription: copy.intro,
    ogUrl: 'https://inkpoem.com/gallery',
    robots: 'index, follow',
  });

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback((from: string | null) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setFailed(false);
    fetchGalleryPage(from, controller.signal).then((page) => {
      if (controller.signal.aborted) return;
      setItems((current) => {
        const seen = new Set(from ? current.map((item) => item.id) : []);
        return [...(from ? current : []), ...page.items.filter((item) => !seen.has(item.id))];
      });
      setCursor(page.nextCursor);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
  }, []);

  useEffect(() => {
    load(null);
    return () => controllerRef.current?.abort();
  }, [load]);

  return (
    <div className="min-h-dvh bg-[#f7f4ed] text-slate-800">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <a href="/" className="text-xl font-semibold tracking-tight text-teal-900">InkPoem</a>
        <a href="/" className="rounded-xl bg-teal-900 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">{copy.create}</a>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4 sm:px-8">
        <h1 className="text-2xl font-semibold sm:text-3xl">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{copy.intro}</p>

        {items.length > 0 ? (
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <a href={item.url} className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-800">
                  <div className="aspect-[1200/630] overflow-hidden rounded-lg bg-white shadow-[0_8px_30px_rgba(17,42,40,0.10)]">
                    <img src={item.cardUrl} alt={item.title || copy.untitled} loading="lazy" decoding="async"
                      width={1200} height={630}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                  </div>
                  <p className="mt-3 truncate font-medium text-slate-900">{item.title || copy.untitled}</p>
                  {item.author ? <p className="truncate text-sm text-slate-600">{item.author}</p> : null}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {loading ? (
          <p role="status" className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 size={18} className="animate-spin" />{copy.loading}
          </p>
        ) : failed ? (
          <div role="alert" className="mt-10 flex flex-col items-center gap-3 text-center">
            <p className="text-slate-700">{copy.loadError}</p>
            <button type="button" onClick={() => load(items.length > 0 ? cursor : null)}
              className="min-h-11 rounded-xl bg-teal-900 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800">
              {copy.retry}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white/60 px-6 py-14 text-center">
            <p className="text-slate-700">{copy.empty}</p>
            <a href="/" className="text-sm text-teal-800 underline">{copy.create}</a>
          </div>
        ) : cursor ? (
          <div className="mt-10 flex justify-center">
            <button type="button" onClick={() => load(cursor)}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-medium hover:bg-slate-50">
              {copy.loadMore}
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
