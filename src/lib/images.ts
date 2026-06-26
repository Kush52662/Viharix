// High quality, beautiful Google Maps static/vector map fallbacks for each travel category to completely replace Unsplash.
export const MAP_PLACEHOLDER_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" style="background:%23f8fafc;"><path d="M0 50 L600 50 M0 100 L600 100 M0 150 L600 150 M0 200 L600 200 M0 250 L600 250 M0 300 L600 300 M0 350 L600 350 M75 0 L75 400 M150 0 L150 400 M225 0 L225 400 M300 0 L300 400 M375 0 L375 400 M450 0 L450 400 M525 0 L525 400" stroke="%23f1f5f9" stroke-width="2"/><path d="M0 100 Q150 150 300 100 T600 100" fill="none" stroke="%23e2e8f0" stroke-width="4"/><path d="M100 0 Q150 200 100 400" fill="none" stroke="%23e2e8f0" stroke-width="4"/><circle cx="300" cy="200" r="16" fill="%23ff385c" opacity="0.15"/><circle cx="300" cy="200" r="10" fill="%23ff385c" opacity="0.4"/><circle cx="300" cy="200" r="5" fill="%23ff385c"/></svg>`;

export const CATEGORY_IMAGES: Record<string, string> = {
  Food: MAP_PLACEHOLDER_SVG,
  Sightseeing: MAP_PLACEHOLDER_SVG,
  Transit: MAP_PLACEHOLDER_SVG,
  Shopping: MAP_PLACEHOLDER_SVG,
  Event: MAP_PLACEHOLDER_SVG,
  Work: MAP_PLACEHOLDER_SVG,
  Rest: MAP_PLACEHOLDER_SVG,
  Custom: MAP_PLACEHOLDER_SVG,
};

// Map category to a Tailwind badge color
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; primary: string }> = {
  Food: { bg: "bg-amber-50", text: "text-amber-700", primary: "#F59E0B" },
  Sightseeing: { bg: "bg-teal-50", text: "text-teal-700", primary: "#0F766E" },
  Transit: { bg: "bg-sky-50", text: "text-sky-700", primary: "#0284C7" },
  Shopping: { bg: "bg-rose-50", text: "text-rose-700", primary: "#E11D48" },
  Event: { bg: "bg-indigo-50", text: "text-indigo-700", primary: "#4F46E5" },
  Work: { bg: "bg-slate-50", text: "text-slate-700", primary: "#475569" },
  Rest: { bg: "bg-purple-50", text: "text-purple-700", primary: "#9333EA" },
  Custom: { bg: "bg-emerald-50", text: "text-emerald-700", primary: "#059669" },
};

export const getMapsKey = (): string => {
  return (
    (typeof process !== 'undefined' ? process.env?.GOOGLE_MAPS_PLATFORM_KEY : "") ||
    (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
    (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
    ""
  );
};

export function getCleanImage(url?: string, title?: string, location?: string, category?: string): string {
  const apiKey = getMapsKey();
  const isUnsplash = url && url.includes("unsplash.com");
  
  if (!url || isUnsplash) {
    const searchCenter = location || title || category || "Travel";
    if (apiKey) {
      return `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(searchCenter)}&zoom=14&size=600x400&scale=2&maptype=roadmap&markers=color:0xff385c%7C${encodeURIComponent(searchCenter)}&key=${apiKey}`;
    }
    return MAP_PLACEHOLDER_SVG;
  }
  
  return url;
}

export function getCleanMediaArray(media?: string[], title?: string, location?: string, category?: string): string[] {
  if (!media || media.length === 0) {
    return [getCleanImage(undefined, title, location, category)];
  }
  const cleaned = media.filter(m => !m.includes("unsplash.com"));
  if (cleaned.length === 0) {
    return [getCleanImage(undefined, title, location, category)];
  }
  return cleaned;
}

export function getCategoryImage(category: string, title?: string, location?: string): string {
  return getCleanImage(undefined, title, location, category);
}
