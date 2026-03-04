import { useEffect } from "react";

interface PageMeta {
  title: string;
  description: string;
  canonicalPath?: string;
}

function getOrCreateMeta(selector: string, createAttrs: Record<string, string>): Element {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    for (const [key, value] of Object.entries(createAttrs)) {
      el.setAttribute(key, value);
    }
    document.head.appendChild(el);
  }
  return el;
}

export function usePageMeta({ title, description, canonicalPath }: PageMeta) {
  useEffect(() => {
    document.title = title;

    const baseUrl = "https://cellionone.com";
    const canonicalUrl = canonicalPath ? `${baseUrl}${canonicalPath}` : baseUrl;

    getOrCreateMeta('meta[name="description"]', { name: "description" })
      .setAttribute("content", description);

    getOrCreateMeta('meta[property="og:title"]', { property: "og:title" })
      .setAttribute("content", title);

    getOrCreateMeta('meta[property="og:description"]', { property: "og:description" })
      .setAttribute("content", description);

    getOrCreateMeta('meta[property="og:url"]', { property: "og:url" })
      .setAttribute("content", canonicalUrl);

    getOrCreateMeta('meta[name="twitter:title"]', { name: "twitter:title" })
      .setAttribute("content", title);

    getOrCreateMeta('meta[name="twitter:description"]', { name: "twitter:description" })
      .setAttribute("content", description);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalUrl);

    return () => {
      document.title = "Cellion One \u2014 Company Incorporation & KYC Verification in Nigeria";
    };
  }, [title, description, canonicalPath]);
}
