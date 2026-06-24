// High quality, beautiful Unsplash images for each travel category
export const CATEGORY_IMAGES: Record<string, string> = {
  Food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
  Sightseeing: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80",
  Transit: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80",
  Shopping: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80",
  Event: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80",
  Work: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
  Rest: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=800&q=80",
  Custom: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80",
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

export function getCategoryImage(category: string, title?: string): string {
  // Simple heuristic: check if any title keywords match other categories
  const normTitle = (title || "").toLowerCase();
  if (normTitle.includes("cafe") || normTitle.includes("restaurant") || normTitle.includes("dinner") || normTitle.includes("food") || normTitle.includes("lunch") || normTitle.includes("breakfast") || normTitle.includes("coffee") || normTitle.includes("bar")) {
    return CATEGORY_IMAGES.Food;
  }
  if (normTitle.includes("museum") || normTitle.includes("tour") || normTitle.includes("beach") || normTitle.includes("view") || normTitle.includes("park") || normTitle.includes("hike") || normTitle.includes("mountain") || normTitle.includes("temple") || normTitle.includes("cathedral") || normTitle.includes("castle")) {
    return CATEGORY_IMAGES.Sightseeing;
  }
  if (normTitle.includes("flight") || normTitle.includes("train") || normTitle.includes("taxi") || normTitle.includes("bus") || normTitle.includes("drive") || normTitle.includes("subway") || normTitle.includes("car")) {
    return CATEGORY_IMAGES.Transit;
  }
  if (normTitle.includes("mall") || normTitle.includes("shop") || normTitle.includes("market") || normTitle.includes("gift") || normTitle.includes("boutique")) {
    return CATEGORY_IMAGES.Shopping;
  }
  if (normTitle.includes("concert") || normTitle.includes("show") || normTitle.includes("party") || normTitle.includes("festival") || normTitle.includes("theatre")) {
    return CATEGORY_IMAGES.Event;
  }
  if (normTitle.includes("sleep") || normTitle.includes("relax") || normTitle.includes("nap") || normTitle.includes("spa") || normTitle.includes("hotel") || normTitle.includes("pool")) {
    return CATEGORY_IMAGES.Rest;
  }
  
  const cleanCat = category as keyof typeof CATEGORY_IMAGES;
  return CATEGORY_IMAGES[cleanCat] || CATEGORY_IMAGES.Custom;
}
