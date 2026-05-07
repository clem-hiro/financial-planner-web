"use client";

import { useEffect, useState } from "react";

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 500);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-5 right-5 z-30 rounded-full bg-[#0c192f] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-slate-900/30 transition hover:bg-[#152a45]"
      aria-label="Back to top"
    >
      Top
    </button>
  );
}
