import { useCallback, useRef, useState } from 'react';

const DEFAULT_MAX_HISTORY = 50;

/**
 * Generic undo/redo history stack.
 *
 * - `push(snapshot)` records a new state.  Any future states that had been
 *   redone are discarded (standard undo behaviour).
 * - `undo()` moves the cursor back one step and returns the snapshot to restore,
 *   or null if already at the oldest state.
 * - `redo()` moves the cursor forward one step and returns the snapshot to
 *   restore, or null if already at the newest state.
 * - `canUndo` / `canRedo` are reactive booleans for driving button disabled
 *   states; they update whenever the cursor moves.
 */
export function useUndoHistory<T>(maxHistory = DEFAULT_MAX_HISTORY) {
  const historyRef = useRef<T[]>([]);
  const indexRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const push = useCallback(
    (snapshot: T) => {
      // Discard any states ahead of the current cursor
      historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
      historyRef.current.push(snapshot);
      if (historyRef.current.length > maxHistory) {
        historyRef.current.shift();
        // index stays the same — the entry we removed was behind the cursor
      } else {
        indexRef.current += 1;
      }
      setCanUndo(indexRef.current > 0);
      setCanRedo(false);
    },
    [maxHistory],
  );

  const undo = useCallback((): T | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current -= 1;
    setCanUndo(indexRef.current > 0);
    setCanRedo(true);
    return historyRef.current[indexRef.current];
  }, []);

  const redo = useCallback((): T | null => {
    if (indexRef.current >= historyRef.current.length - 1) return null;
    indexRef.current += 1;
    setCanUndo(true);
    setCanRedo(indexRef.current < historyRef.current.length - 1);
    return historyRef.current[indexRef.current];
  }, []);

  return { push, undo, redo, canUndo, canRedo };
}
