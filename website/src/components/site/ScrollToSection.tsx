"use client";

import { useEffect } from "react";

export function ScrollToSection() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;

    const el = document.getElementById(id);
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (el) requestAnimationFrame(() => el.scrollIntoView());
  }, []);

  return null;
}
