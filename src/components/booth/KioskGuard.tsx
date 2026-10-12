"use client";

import { useEffect } from "react";

export function KioskGuard() {
  useEffect(() => {
    const block = (event: Event) => event.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, []);
  return null;
}
