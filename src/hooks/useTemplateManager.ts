import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { DEFAULT_POEM_STYLE, isSamePoemLayerStyle } from '../poemStyle';
import { createAsyncIntentGate } from '../asyncIntentGate';
import { createReusableTemplateParts, type EditorDocument } from '../editorDocument';
import type { EditorTemplateParts, EditorTemplateSections } from '../editorCommands';
import { resolveTemplateForLanguage } from '../templates';
import type { Language } from '../translations';
import type {
  BorderStyle,
  CustomText,
  EditorTemplateId,
  ExpandedSections,
  LogoConfig,
  PoemLayerStyle,
  StampConfig,
  SignatureConfig,
  TemplateBackgroundConfig,
  TemplateDecorationsConfig,
  TemplateTypographyConfig,
  TextAlign,
  UserCustomTemplate,
  WritingMode,
} from '../types';

const ACTIVE_TEMPLATE_STORAGE_KEY = 'poem-to-image.active-template';

interface TypographyState {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  textAlign: TextAlign;
  writingMode: WritingMode;
  padding: number;
  lineHeight: number;
  letterSpacing: number;
  columns: number;
  columnGap: number;
  textShadowEnabled: boolean;
  textShadowColor: string;
  textShadowBlur: number;
  textShadowOffsetY: number;
  textShadowOffsetX: number;
}

interface DecorationsState {
  showBorder: boolean;
  borderStyle: BorderStyle;
  borderColor: string;
  borderWidth: number;
  showStamp: boolean;
  signatures: SignatureConfig[];
  poemPosition: { positionX: number; positionY: number };
  stamp: StampConfig;
  customTexts: CustomText[];
  logos: LogoConfig[];
}

interface CustomTemplatesState {
  customTemplates: UserCustomTemplate[];
  canSaveCustomTemplate: boolean;
  saveCustomTemplate: (
    name: string,
    background: TemplateBackgroundConfig,
    typography: TemplateTypographyConfig,
    decorations: TemplateDecorationsConfig,
    poemStyle: PoemLayerStyle,
    shouldActivate: () => boolean,
  ) => Promise<UserCustomTemplate | null>;
  applyCustomTemplate: (id: string) => void;
  clearActiveCustomTemplate: () => void;
}

interface UseTemplateManagerParams {
  language: Language;
  hasPersistedEditorState: boolean;
  typography: TypographyState;
  decorations: DecorationsState;
  poemStyle: PoemLayerStyle;
  editorDocument: EditorDocument;
  applyEditorTemplate: (template: EditorTemplateParts, sections?: EditorTemplateSections) => void;
  setExpandedSections: Dispatch<SetStateAction<ExpandedSections>>;
  customTemplates: CustomTemplatesState;
}

function matchesTypography(
  templateId: EditorTemplateId,
  lang: Language,
  typography: TypographyState,
): boolean {
  const resolved = resolveTemplateForLanguage(templateId, lang);
  if (!resolved) return false;
  const t = resolved.typography;
  return (
    typography.fontFamily === t.fontFamily &&
    typography.fontSize === t.fontSize &&
    typography.textColor === t.textColor &&
    typography.textAlign === t.textAlign &&
    typography.writingMode === t.writingMode &&
    typography.padding === t.padding &&
    typography.lineHeight === t.lineHeight &&
    typography.letterSpacing === t.letterSpacing &&
    typography.columns === t.columns &&
    typography.columnGap === t.columnGap &&
    typography.textShadowEnabled === t.textShadowEnabled &&
    typography.textShadowColor === t.textShadowColor &&
    typography.textShadowBlur === t.textShadowBlur &&
    typography.textShadowOffsetY === t.textShadowOffsetY &&
    typography.textShadowOffsetX === t.textShadowOffsetX
  );
}

function matchesDecorations(
  templateId: EditorTemplateId,
  lang: Language,
  decorations: DecorationsState,
): boolean {
  const resolved = resolveTemplateForLanguage(templateId, lang);
  if (!resolved) return false;
  const d = resolved.decorations;
  return (
    decorations.showBorder === d.showBorder &&
    decorations.borderStyle === d.borderStyle &&
    decorations.borderColor === (d.borderColor ?? resolved.typography.textColor) &&
    decorations.borderWidth === (d.borderWidth ?? 4) &&
    decorations.showStamp === d.showStamp &&
    decorations.poemPosition.positionX === d.poemPosition.positionX &&
    decorations.poemPosition.positionY === d.poemPosition.positionY &&
    decorations.stamp.text === d.stamp.text &&
    decorations.stamp.style === d.stamp.style &&
    // A user-chosen seal mode, face, ink, weathering or font makes these
    // decorations custom; switching UI language must not reapply the stamp.
    decorations.stamp.mode === d.stamp.mode &&
    decorations.stamp.colorScheme === d.stamp.colorScheme &&
    decorations.stamp.inkColor === d.stamp.inkColor &&
    decorations.stamp.weathering === d.stamp.weathering &&
    decorations.stamp.textScale === d.stamp.textScale &&
    decorations.stamp.textStrokeWidthPct === d.stamp.textStrokeWidthPct &&
    decorations.stamp.textureStyle === d.stamp.textureStyle &&
    decorations.stamp.textureSeed === d.stamp.textureSeed &&
    decorations.stamp.fontFamily === d.stamp.fontFamily &&
    decorations.stamp.positionX === d.stamp.positionX &&
    decorations.stamp.positionY === d.stamp.positionY &&
    decorations.stamp.size === d.stamp.size &&
    decorations.stamp.rotation === d.stamp.rotation &&
    decorations.stamp.opacity === d.stamp.opacity &&
    decorations.customTexts.length === d.customTexts.length &&
    // Preserve any user-edited signature during a language switch instead of
    // silently replacing it with the template's localized placeholder.
    decorations.signatures.length === (d.signatures?.length ?? 0) &&
    decorations.signatures.every((sig, index) => {
      const expected = d.signatures?.[index];
      return expected !== undefined &&
        (Object.keys(expected) as Array<keyof SignatureConfig>).every((key) => sig[key] === expected[key]);
    })
  );
}

function matchesPoemStyle(
  templateId: EditorTemplateId,
  lang: Language,
  poemStyle: PoemLayerStyle,
): boolean {
  const resolved = resolveTemplateForLanguage(templateId, lang);
  if (!resolved?.poemStyle) return false;
  return isSamePoemLayerStyle(poemStyle, resolved.poemStyle);
}

export function useTemplateManager({
  language,
  hasPersistedEditorState,
  typography,
  decorations,
  poemStyle,
  editorDocument,
  applyEditorTemplate,
  setExpandedSections,
  customTemplates,
}: UseTemplateManagerParams) {
  const [activeTemplateId, setActiveTemplateId] = useState<EditorTemplateId | null>(null);
  const previousLanguageRef = useRef(language);
  // Selection intent outlives individual cloud writes. Saving data does not
  // grant a pending request permission to replace a newer user selection.
  const selectionIntentRef = useRef(createAsyncIntentGate());

  // ── Apply built-in template ───────────────────────────────────────────────

  const applyTemplateById = useCallback(
    (templateId: EditorTemplateId, options?: { expandSections?: boolean }): boolean => {
      const template = resolveTemplateForLanguage(templateId, language);
      if (!template) return false;

      applyEditorTemplate({
        background: template.background,
        typography: template.typography,
        decorations: template.decorations,
        poemStyle: template.poemStyle ?? { ...DEFAULT_POEM_STYLE },
      });
      setActiveTemplateId(templateId);

      if (options?.expandSections ?? true) {
        setExpandedSections((prev) => ({
          ...prev,
          templates: true,
          background: true,
          typography: true,
          decorations: true,
        }));
      }

      return true;
    },
    [language, applyEditorTemplate, setExpandedSections],
  );

  // ── Public handlers ───────────────────────────────────────────────────────

  const handleApplyTemplate = useCallback(
    (templateId: EditorTemplateId) => {
      if (!applyTemplateById(templateId)) return;
      selectionIntentRef.current.invalidate();
      customTemplates.clearActiveCustomTemplate();
    },
    [applyTemplateById, customTemplates],
  );

  const handleApplyCustomTemplate = useCallback(
    (id: string) => {
      const template = customTemplates.customTemplates.find((t) => t.id === id);
      if (!template) return;
      selectionIntentRef.current.invalidate();
      applyEditorTemplate({
        background: template.background,
        typography: template.typography,
        decorations: template.decorations,
        poemStyle: template.poemStyle,
      });
      customTemplates.applyCustomTemplate(id);
      setActiveTemplateId(null);
      setExpandedSections((prev) => ({
        ...prev,
        templates: true,
        background: true,
        typography: true,
        decorations: true,
      }));
    },
    [applyEditorTemplate, customTemplates, setExpandedSections],
  );

  const handleSaveCustomTemplate = useCallback(
    async (name: string): Promise<boolean> => {
      // The identity may be unresolved while Clerk loads or changes account.
      // Do not treat a silent null result as a completed user save.
      if (!customTemplates.canSaveCustomTemplate) return false;
      const saveEpoch = selectionIntentRef.current.begin();
      const shouldActivate = () => selectionIntentRef.current.isCurrent(saveEpoch);
      const { background: bgConfig, typography: typConfig, decorations: decConfig, poemStyle } =
        createReusableTemplateParts(editorDocument);
      const created = await customTemplates.saveCustomTemplate(
        name, bgConfig, typConfig, decConfig, poemStyle, shouldActivate,
      );
      if (!created) return false;
      // Never reset a template selected while this save was in flight.
      if (shouldActivate()) setActiveTemplateId(null);
      return true;
    },
    [editorDocument, customTemplates],
  );

  // ── Restore active template from localStorage on mount ────────────────────

  useEffect(() => {
    const storedTemplateId = window.localStorage.getItem(
      ACTIVE_TEMPLATE_STORAGE_KEY,
    ) as EditorTemplateId | null;
    if (!storedTemplateId) return;

    const template = resolveTemplateForLanguage(storedTemplateId, language);
    if (!template) {
      window.localStorage.removeItem(ACTIVE_TEMPLATE_STORAGE_KEY);
      return;
    }

    // A saved editor draft takes precedence over the template selection marker.
    // Applying the template again on mount would erase custom fonts/backgrounds.
    if (!hasPersistedEditorState) {
      applyEditorTemplate({
        background: template.background,
        typography: template.typography,
        decorations: template.decorations,
        poemStyle: template.poemStyle ?? { ...DEFAULT_POEM_STYLE },
      });
    }
    setActiveTemplateId(storedTemplateId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist active template to localStorage ───────────────────────────────

  useEffect(() => {
    if (!activeTemplateId) {
      window.localStorage.removeItem(ACTIVE_TEMPLATE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(ACTIVE_TEMPLATE_STORAGE_KEY, activeTemplateId);
  }, [activeTemplateId]);

  // ── Sync typography/decorations on language change ────────────────────────

  useEffect(() => {
    const previousLanguage = previousLanguageRef.current;
    if (previousLanguage === language) return;

    if (!activeTemplateId) {
      previousLanguageRef.current = language;
      return;
    }

    const shouldSyncTypography = matchesTypography(activeTemplateId, previousLanguage, typography);
    const shouldSyncDecorations = matchesDecorations(
      activeTemplateId,
      previousLanguage,
      decorations,
    );
    const shouldSyncPoemStyle = matchesPoemStyle(activeTemplateId, previousLanguage, poemStyle);

    if (shouldSyncTypography || shouldSyncDecorations || shouldSyncPoemStyle) {
      const resolved = resolveTemplateForLanguage(activeTemplateId, language);
      if (resolved) {
        applyEditorTemplate({
          background: resolved.background,
          typography: resolved.typography,
          decorations: resolved.decorations,
          poemStyle: resolved.poemStyle ?? { ...DEFAULT_POEM_STYLE },
        }, {
          background: false,
          typography: shouldSyncTypography,
          decorations: shouldSyncDecorations,
          poemStyle: shouldSyncPoemStyle,
        });
      }
    }

    previousLanguageRef.current = language;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplateId, language]);

  return {
    activeTemplateId,
    handleApplyTemplate,
    handleApplyCustomTemplate,
    handleSaveCustomTemplate,
  };
}
