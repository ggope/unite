'use client';
import { startTransition, type FormEvent } from 'react';

// React empties a form after its action runs, even when the action only says "this is too short".
// Calling the action from onSubmit instead keeps everything the person typed, so a mistake costs one fix, not a rewrite.
export const keepForm = (action: (f: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  startTransition(() => action(data));
};
