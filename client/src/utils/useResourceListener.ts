import { useEffect, useRef } from 'react';
import { subscribeResourceKind, subscribeAnyResourceChange } from './resourceCache';
import type { TResource } from './resourceKeys';

/**
 * Calls `onChange` whenever one of `resources` changes via a WebSocket `update` message, or the
 * connection drops for even a moment (any resource could have been missed) — while this
 * component is mounted. Unlike `useResource`, this doesn't cache/store any data itself and
 * doesn't persist a "dirty" flag across unmounts; it's for consumers that already refetch their
 * own state on every mount (e.g. `useTimeWindowScroll`'s paginated lists) and only need a live
 * "refresh now" signal while visible.
 */
const useResourceListener = (resources: TResource[], onChange: () => void): void => {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const resourcesKey = resources.join(',');
  useEffect(() => {
    const unsubscribes = resources.map((resource) => subscribeResourceKind(resource, () => onChangeRef.current()));
    const unsubscribeAny = subscribeAnyResourceChange(() => onChangeRef.current());
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      unsubscribeAny();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourcesKey]);
};

export default useResourceListener;

