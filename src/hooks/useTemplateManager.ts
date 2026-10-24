import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { DEFAULT_POEM_STYLE, isSamePoemLayerStyle } from '../poemStyle';
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
  TemplateBackgroundConfig,
  TemplateDecorationsConfig,
  TemplateTypographyConfig,
  TextAlign,
  UserCustomTemplate,
  WritingMode,
} from '../types';

const ACTIVE_TEMPLATE_STORAGE_KEY = 'poem-to-image.active-template';

interface BackgroundState {
  backgroundType: string;
  backgroundColor: string;
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: string;
  bgBrightness: number;
  bgBlur: number;
  applyBackgroundTemplate: (bg: TemplateBackgroundConfig) => void;
}

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
  applyTypographyTemplate: (typ: TemplateTypographyConfig) => void;
}

interface DecorationsState {
  showBorder: boolean;
  borderStyle: BorderStyle;
  borderColor: string;
  borderWidth: number;
  showStamp: boolean;
  poemPosition: { positionX: number; positionY: number };
  stamp: StampConfig;
  customTexts: CustomText[];
  logos: LogoConfig[];
  applyDecorationsTemplate: (dec: TemplateDecorationsConfig) => void;
}

interface CustomTemplatesState {
  customTemplates: UserCustomTemplate[];
  saveCustomTemplate: (
    name: string,
    background: TemplateBackgroundConfig,
    typography: TemplateTypographyConfig,
    decorations: TemplateDecorationsConfig,
    poemStyle: PoemLayerStyle,
  ) => Promise<UserCustomTemplate | null>;
  applyCustomTemplate: (id: string) => void;
  clearActiveCustomTemplate: () => void;
}

interface UseTemplateManagerParams {
  language: Language;
  hasPersistedEditorState: boolean;
  background: BackgroundState;
  typography: TypographyState;
  decorations: DecorationsState;
  poemStyle: PoemLayerStyle;
  setPoemStyle: (ps: PoemLayerStyle) => void;
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
    decorations.stamp.positionX === d.stamp.positionX &&
    decorations.stamp.positionY === d.stamp.positionY &&
    decorations.stamp.size === d.stamp.size &&
    decorations.stamp.rotation === d.stamp.rotation &&
    decorations.stamp.opacity === d.stamp.opacity &&
    decorations.customTexts.length === d.customTexts.length
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
  background,
  typography,
  decorations,
  poemStyle,
  setPoemStyle,
  setExpandedSections,
  customTemplates,
}: UseTemplateManagerParams) {
  const [activeTemplateId, setActiveTemplateId] = useState<EditorTemplateId | null>(null);
  const previousLanguageRef = useRef(language);

  // ── Apply built-in template ───────────────────────────────────────────────

  const applyTemplateById = useCallback(
    (templateId: EditorTemplateId, options?: { expandSections?: boolean }): boolean => {
      const template = resolveTemplateForLanguage(templateId, language);
      if (!template) return false;

      background.applyBackgroundTemplate(template.background);
      typography.applyTypographyTemplate(template.typography);
      decorations.applyDecorationsTemplate(template.decorations);
      setPoemStyle(template.poemStyle ?? { ...DEFAULT_POEM_STYLE });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language],
  );

  // ── Public handlers ───────────────────────────────────────────────────────

  const handleApplyTemplate = useCallback(
    (templateId: EditorTemplateId) => {
      applyTemplateById(templateId);
      customTemplates.clearActiveCustomTemplate();
    },
    [applyTemplateById, customTemplates],
  );

  const handleApplyCustomTemplate = useCallback(
    (id: string) => {
      const template = customTemplates.customTemplates.find((t) => t.id === id);
      if (!template) return;
      background.applyBackgroundTemplate(template.background);
      typography.applyTypographyTemplate(template.typography);
      decorations.applyDecorationsTemplate(template.decorations);
      setPoemStyle(template.poemStyle);
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
    [background, typography, decorations, setPoemStyle, customTemplates, setExpandedSections],
  );

  const handleSaveCustomTemplate = useCallback(
    (name: string) => {
      const bgConfig: TemplateBackgroundConfig = {
        backgroundType:
          background.backgroundType === 'image' || background.backgroundType === 'ai'
            ? 'solid'
            : (background.backgroundType as TemplateBackgroundConfig['backgroundType']),
        backgroundColor: background.backgroundColor,
        gradientColor1: background.gradientColor1,
        gradientColor2: background.gradientColor2,
        gradientDirection: background.gradientDirection,
        backgroundImage: null,
        bgBrightness: background.bgBrightness,
        bgBlur: background.bgBlur,
      };
      const typConfig: TemplateTypographyConfig = {
        fontFamily: typography.fontFamily,
        fontSize: typography.fontSize,
        textColor: typography.textColor,
        textAlign: typography.textAlign,
        writingMode: typography.writingMode,
        padding: typography.padding,
        lineHeight: typography.lineHeight,
        letterSpacing: typography.letterSpacing,
        columns: typography.columns,
        columnGap: typography.columnGap,
        textShadowEnabled: typography.textShadowEnabled,
        textShadowColor: typography.textShadowColor,
        textShadowBlur: typography.textShadowBlur,
        textShadowOffsetY: typography.textShadowOffsetY,
        textShadowOffsetX: typography.textShadowOffsetX,
      };
      const decConfig: TemplateDecorationsConfig = {
        showBorder: decorations.showBorder,
        borderStyle: decorations.borderStyle,
        borderColor: decorations.borderColor,
        borderWidth: decorations.borderWidth,
        showStamp: decorations.showStamp,
        stamp: decorations.stamp,
        poemPosition: decorations.poemPosition,
        customTexts: decorations.customTexts,
        logos: [],
      };
      void customTemplates.saveCustomTemplate(name, bgConfig, typConfig, decConfig, poemStyle);
      setActiveTemplateId(null);
    },
    [background, typography, decorations, poemStyle, customTemplates],
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
      background.applyBackgroundTemplate(template.background);
      typography.applyTypographyTemplate(template.typography);
      decorations.applyDecorationsTemplate(template.decorations);
      setPoemStyle(template.poemStyle ?? { ...DEFAULT_POEM_STYLE });
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
        if (shouldSyncTypography) typography.applyTypographyTemplate(resolved.typography);
        if (shouldSyncDecorations) decorations.applyDecorationsTemplate(resolved.decorations);
        if (shouldSyncPoemStyle) setPoemStyle(resolved.poemStyle ?? { ...DEFAULT_POEM_STYLE });
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
