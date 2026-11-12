import { createContext, useCallback, useContext, useEffect, useRef } from 'react';

export interface PreviewInteractionRegistry {
  register: (cancel: () => void) => () => void;
  cancelAll: () => void;
}

export function createPreviewInteractionRegistry(): PreviewInteractionRegistry {
  const active = new Set<() => void>();
  return {
    register(cancel) {
      active.add(cancel);
      return () => { active.delete(cancel); };
    },
    cancelAll() {
      for (const cancel of [...active]) cancel();
    },
  };
}

export const PreviewInteractionContext = createContext<PreviewInteractionRegistry | null>(null);

interface PointerInteraction {
  onMove: (event: PointerEvent) => void;
  onCommit: () => void;
  onCancel: () => void;
}

/** A preview edit owns its listeners until it completes, is cancelled, or unmounts. */
export function usePreviewPointerInteraction(onStart: () => void, onEnd: () => void) {
  const registry = useContext(PreviewInteractionContext);
  const activeRef = useRef(new Set<() => void>());

  useEffect(() => {
    const active = activeRef.current;
    return () => { for (const cancel of [...active]) cancel(); };
  }, []);

  return useCallback((pointerId: number, interaction: PointerInteraction) => {
    let finished = false;
    let unregister = () => {};
    const active = activeRef.current;
    const finish = (commit: boolean) => {
      if (finished) return;
      finished = true;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      unregister();
      active.delete(cancel);
      try {
        if (commit) interaction.onCommit();
        else interaction.onCancel();
      } finally {
        onEnd();
      }
    };
    const handleMove = (event: PointerEvent) => {
      if (event.pointerId === pointerId) interaction.onMove(event);
    };
    const handleUp = (event: PointerEvent) => {
      if (event.pointerId === pointerId) finish(true);
    };
    const handleCancel = (event: PointerEvent) => {
      if (event.pointerId === pointerId) finish(false);
    };
    const cancel = () => finish(false);

    onStart();
    active.add(cancel);
    unregister = registry?.register(cancel) ?? unregister;
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
  }, [registry, onStart, onEnd]);
}
