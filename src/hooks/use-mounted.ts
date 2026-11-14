"use client";

import { useEffect, useState } from "react";

/**
 * True after hydration. Used to keep float-sensitive geometry out of the
 * server render, where Node and the browser can differ in the last digit.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
