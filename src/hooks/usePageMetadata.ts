import { useEffect } from 'react';

interface PageMetadataOptions {
  title: string;
  description?: string;
  canonical?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
}

function upsertMetaByName(name: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('name', name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertMetaByProperty(property: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('property', property);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertCanonicalLink(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

export function usePageMetadata({
  title,
  description,
  canonical,
  robots,
  ogTitle,
  ogDescription,
  ogUrl,
}: PageMetadataOptions) {
  useEffect(() => {
    document.title = title;

    if (description) {
      upsertMetaByName('description', description);
    }

    if (robots) {
      upsertMetaByName('robots', robots);
    }

    if (canonical) {
      upsertCanonicalLink(canonical);
    }

    if (ogTitle) {
      upsertMetaByProperty('og:title', ogTitle);
    }

    if (ogDescription) {
      upsertMetaByProperty('og:description', ogDescription);
    }

    if (ogUrl) {
      upsertMetaByProperty('og:url', ogUrl);
    }
  }, [canonical, description, ogDescription, ogTitle, ogUrl, robots, title]);
}
