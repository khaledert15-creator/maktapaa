import { useEffect } from "react";

type JsonLd = Record<string, unknown> | Record<string, unknown>[];

export function Seo({ title, description, image, canonicalPath, jsonLd }: { title: string; description?: string | null; image?: string | null; canonicalPath?: string; jsonLd?: JsonLd }) {
  useEffect(() => {
    document.title = title;
    const canonical = new URL(canonicalPath || window.location.pathname, window.location.origin).href;
    const socialImage = new URL(image || "/social-default.svg", window.location.origin).href;
    const setMeta = (name: string, content: string, property = false) => {
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let tag = document.head.querySelector<HTMLMetaElement>(selector);
      if (!tag) { tag = document.createElement("meta"); tag.setAttribute(property ? "property" : "name", name); document.head.appendChild(tag); }
      tag.content = content;
    };
    if (description) { setMeta("description", description); setMeta("og:description", description, true); setMeta("twitter:description", description); }
    setMeta("og:title", title, true); setMeta("twitter:title", title);
    setMeta("og:url", canonical, true); setMeta("og:image", socialImage, true); setMeta("twitter:image", socialImage);
    let canonicalTag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalTag) { canonicalTag = document.createElement("link"); canonicalTag.rel = "canonical"; document.head.appendChild(canonicalTag); }
    canonicalTag.href = canonical;
    document.head.querySelectorAll("script[data-client-json-ld]").forEach(script => script.remove());
    if (jsonLd) for (const entry of Array.isArray(jsonLd) ? jsonLd : [jsonLd]) {
      const script = document.createElement("script"); script.dataset.clientJsonLd = "true"; script.type = "application/ld+json"; script.textContent = JSON.stringify(entry); document.head.appendChild(script);
    }
    return () => document.head.querySelectorAll("script[data-client-json-ld]").forEach(script => script.remove());
  }, [title, description, image, canonicalPath, jsonLd]);
  return null;
}
