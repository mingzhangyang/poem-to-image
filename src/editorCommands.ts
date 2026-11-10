import { getCanvasSizePresetById } from './canvasPresets';
import type { EditorDocument } from './editorDocument';
import type {
  PoemContentData,
  PoemLayerStyle,
  TemplateBackgroundConfig,
  TemplateDecorationsConfig,
  TemplateTypographyConfig,
} from './types';

export interface EditorTemplateParts {
  background: TemplateBackgroundConfig;
  typography: TemplateTypographyConfig;
  decorations: TemplateDecorationsConfig;
  poemStyle: PoemLayerStyle;
}

export interface EditorTemplateSections {
  background?: boolean;
  typography?: boolean;
  decorations?: boolean;
  poemStyle?: boolean;
}

export type EditorCommand =
  | { type: 'restore'; document: EditorDocument }
  | { type: 'template'; template: EditorTemplateParts; sections?: EditorTemplateSections }
  | { type: 'canvas-preset'; presetId: string };

export interface EditorCommandTargets {
  setPoem: (value: PoemContentData) => void;
  setPoemStyle: (value: PoemLayerStyle) => void;
  setCanvasWidth: (value: number) => void;
  setCanvasHeight: (value: number) => void;
  setPresetSize: (value: string) => void;
  applyBackground: (value: TemplateBackgroundConfig) => void;
  applyTypography: (value: TemplateTypographyConfig) => void;
  applyDecorations: (value: TemplateDecorationsConfig) => void;
}

/**
 * Shared multi-field command boundary for restore, templates and presets.
 * Each command runs synchronously through the existing React state setters;
 * React batches the resulting state update. Persistence/history observe the
 * final canonical document, never a different hand-built field selection.
 *
 * This intentionally does not change the undo/redo policy or IndexedDB
 * transaction semantics. It is an adapter during the incremental migration
 * toward a fully reducer-owned editor state.
 */
export function executeEditorCommand(command: EditorCommand, targets: EditorCommandTargets): void {
  switch (command.type) {
    case 'restore': {
      const { document } = command;
      targets.setPoem(document.poem);
      targets.setPoemStyle(document.poemStyle);
      targets.setCanvasWidth(document.canvasWidth);
      targets.setCanvasHeight(document.canvasHeight);
      targets.setPresetSize(document.presetSize);
      targets.applyBackground(document.background);
      targets.applyTypography(document.typography);
      targets.applyDecorations(document.decorations);
      return;
    }
    case 'template': {
      const { template, sections } = command;
      if (sections?.background !== false) targets.applyBackground(template.background);
      if (sections?.typography !== false) targets.applyTypography(template.typography);
      if (sections?.decorations !== false) targets.applyDecorations(template.decorations);
      if (sections?.poemStyle !== false) targets.setPoemStyle(template.poemStyle);
      return;
    }
    case 'canvas-preset': {
      const id = command.presetId;
      targets.setPresetSize(id);
      if (id === 'custom') return;
      const preset = getCanvasSizePresetById(id);
      if (preset) {
        targets.setCanvasWidth(preset.width);
        targets.setCanvasHeight(preset.height);
        return;
      }
      // Preserve historical ratio IDs such as 1080x1350.
      const [width, height] = id.split('x').map(Number);
      if (Number.isFinite(width) && Number.isFinite(height)) {
        targets.setCanvasWidth(width);
        targets.setCanvasHeight(height);
      }
      return;
    }
  }
}
