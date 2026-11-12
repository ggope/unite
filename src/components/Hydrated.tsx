'use client';
import { useEffect } from 'react';

// Marks the page as interactive (used by the end-to-end checks to avoid clicking too early).
export function Hydrated() {
  useEffect(() => { document.documentElement.dataset.hydrated = '1'; }, []);
  return null;
}
