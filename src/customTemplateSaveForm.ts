/**
 * The "Save as template" form, kept outside the Templates panel.
 *
 * The panel unmounts whenever the desktop rail or the mobile drawer shows
 * another panel, but a save it started keeps running. Holding the typed name,
 * the open form and the in-flight guard here means a remounted panel shows
 * the pending save instead of offering a second one, and a save the server
 * did not confirm keeps its name for a deliberate retry.
 */
export interface CustomTemplateSaveFormState {
  isOpen: boolean;
  name: string;
  isSubmitting: boolean;
}

export interface CustomTemplateSaveForm {
  getState(): CustomTemplateSaveFormState;
  subscribe(listener: () => void): () => void;
  open(): void;
  /** Closes and clears the form; ignored while a save is in flight. */
  close(): void;
  /** Ignored while a save is in flight: the submitted name is fixed. */
  setName(name: string): void;
  /**
   * Starts one save with the typed name. Returns false without calling
   * `save` while an earlier submission is still in flight.
   */
  submit(save: (name: string) => Promise<boolean>): Promise<boolean>;
}

export const INITIAL_CUSTOM_TEMPLATE_SAVE_FORM: CustomTemplateSaveFormState = {
  isOpen: false,
  name: '',
  isSubmitting: false,
};

export function createCustomTemplateSaveForm(): CustomTemplateSaveForm {
  let state = INITIAL_CUSTOM_TEMPLATE_SAVE_FORM;
  const listeners = new Set<() => void>();
  const setState = (next: CustomTemplateSaveFormState) => {
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    open() {
      if (!state.isOpen) setState({ ...state, isOpen: true });
    },
    close() {
      if (!state.isSubmitting) setState(INITIAL_CUSTOM_TEMPLATE_SAVE_FORM);
    },
    setName(name) {
      if (!state.isSubmitting && name !== state.name) setState({ ...state, name });
    },
    async submit(save) {
      // Synchronous check: a double click or a remounted panel cannot start
      // a second creation for the same submission.
      if (state.isSubmitting) return false;
      setState({ ...state, isSubmitting: true });
      let saved = false;
      try {
        saved = await save(state.name.trim());
        return saved;
      } finally {
        // Keep the typed name and open form unless the save was confirmed.
        setState(saved ? INITIAL_CUSTOM_TEMPLATE_SAVE_FORM : { ...state, isSubmitting: false });
      }
    },
  };
}
