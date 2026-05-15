import { useState, useRef, useCallback } from 'react';
import { ACTION_MIN_MS, ACTION_DONE_MS } from '../config';

export type TActionStatus = 'idle' | 'loading' | 'success' | 'error';


export const useActionFeedback = (): {
  status: TActionStatus;
  run: (action: () => Promise<boolean>) => Promise<void>;
} => {
  const [status, setStatus] = useState<TActionStatus>('idle');
  const ref = useRef<TActionStatus>('idle');

  const run = useCallback(async (action: () => Promise<boolean>): Promise<void> => {
    if (ref.current !== 'idle') return;
    ref.current = 'loading';
    setStatus('loading');
    const t0 = Date.now();
    const ok = await action();
    const wait = ACTION_MIN_MS - (Date.now() - t0);
    if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
    const next: TActionStatus = ok ? 'success' : 'error';
    ref.current = next;
    setStatus(next);
    setTimeout(() => { ref.current = 'idle'; setStatus('idle'); }, ACTION_DONE_MS);
  }, []);

  return { status, run };
};

