import { useEffect } from "react";

export function Seo({ title, description, image, jsonLd }: { title: string; description?: string | null; image?: string | null; jsonLd?: Record<string, unknown> }) {
  useEffect(() => {
    document.title = title;
    const setMeta = (name: string, content: string, property = false) => {
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let tag = document.head.querySelector<HTMLMetaElement>(selector);
      if (!tag) { tag = document.createElement("meta"); tag.setAttribute(property ? "property" : "name", name); document.head.appendChild(tag); }
      tag.content = content;
    };
    if (description) { setMeta("description", description); setMeta("og:description", description, true); }
    setMeta("og:title", title, true);
    if (image) setMeta("og:image", new URL(image, window.location.origin).href, true);
    let script = document.head.querySelector<HTMLScriptElement>("#page-json-ld");
    if (jsonLd) {
      if (!script) { script = document.createElement("script"); script.id = "page-json-ld"; script.type = "application/ld+json"; document.head.appendChild(script); }
      script.textContent = JSON.stringify(jsonLd);
    } else script?.remove();
    return () => document.head.querySelector("#page-json-ld")?.remove();
  }, [title, description, image, jsonLd]);
  return null;
}
