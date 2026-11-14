"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { motionDuration, easing } from "@/lib/design/tokens";

/**
 * Smoothly tweens a number to its new value. Returns the in-flight value.
 * With reduced motion, updates instantly.
 */
export function useAnimatedNumber(value: number, duration: number = motionDuration.meaning): number {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (reduced) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(fromRef.current, value, {
      duration,
      ease: easing.out,
      onUpdate: (v) => {
        fromRef.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduced]);

  return display;
}
