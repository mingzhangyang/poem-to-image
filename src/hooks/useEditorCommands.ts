import { useCallback, useRef } from 'react';
import {
  executeEditorCommand,
  type EditorCommand,
  type EditorCommandTargets,
  type EditorTemplateParts,
  type EditorTemplateSections,
} from '../editorCommands';
import type { EditorDocument } from '../editorDocument';

/** Stable dispatch function; always operates on the current hook setters. */
export function useEditorCommands(targets: EditorCommandTargets) {
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const execute = useCallback((command: EditorCommand) => {
    executeEditorCommand(command, targetsRef.current);
  }, []);

  const restoreDocument = useCallback((document: EditorDocument) => {
    execute({ type: 'restore', document });
  }, [execute]);

  const applyTemplate = useCallback((template: EditorTemplateParts, sections?: EditorTemplateSections) => {
    execute({ type: 'template', template, sections });
  }, [execute]);

  const selectCanvasPreset = useCallback((presetId: string) => {
    execute({ type: 'canvas-preset', presetId });
  }, [execute]);

  return { restoreDocument, applyTemplate, selectCanvasPreset };
}
