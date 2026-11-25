import { useEffect, useRef, useState } from 'react';
import { DEFAULT_STAMP_FONT } from '../fontOptions';
import { getNaturalSealSeed } from '../naturalSealTexture';
import { getDefaultStampTextForLanguage } from '../stampDefaults';
import { reconcileStampGlyphEdits } from '../sealGlyphEditing';
import { DEFAULT_SIGNATURE_FONT } from '../signatureRendering';
import { mergePositionUpdate } from '../positioningRect';
import { getNextLayerIndex, moveLayer, normalizeDecorationLayers } from '../decorationLayers';
import type { LayerDirection } from '../decorationLayers';
import type { Language } from '../translations';
import type { BorderStyle, CustomText, LogoConfig, PositionedElement, SignatureConfig, StampConfig, TemplateDecorationsConfig, TranslateFn, WritingMode } from '../types';

interface UseDecorationsConfigParams {
  language: Language;
  t: TranslateFn;
  fontSize: number;
  textColor: string;
  writingMode: WritingMode;
  onCustomTextAdded?: () => void;
  initialDraft?: TemplateDecorationsConfig;
}

export function useDecorationsConfig({
  language,
  t,
  fontSize,
  textColor,
  writingMode,
  onCustomTextAdded,
  initialDraft,
}: UseDecorationsConfigParams) {
  const createDefaultPoemPosition = (): PositionedElement => ({
    positionX: 50,
    positionY: 50,
  });

  const createDefaultStamp = (): StampConfig => ({
    text: getDefaultStampTextForLanguage(language),
    // Only new stamps opt in; persisted stamps and built-in templates stay unchanged.
    textureStyle: 'natural',
    textureSeed: getNaturalSealSeed({ text: getDefaultStampTextForLanguage(language) }),
    style: 'square',
    // New Chinese text seals use real verified Xiaozhuan; existing drafts keep legacy mode.
    mode: 'zhuwen',
    compositionMode: 'whole',
    compositionTightness: 70,
    compositionVariant: 0,
    colorScheme: 'outline',
    inkColor: '#c82829',
    weathering: 50,
    positionX: 80,
    positionY: 80,
    size: Math.round(fontSize * 2.5),
    textScale: 1,
    textStrokeWidthPct: 2,
    rotation: -8,
    opacity: 0.82,
    fontFamily: DEFAULT_STAMP_FONT,
  });

  const [showBorder, setShowBorder] = useState(() => initialDraft?.showBorder ?? false);
  const [borderStyle, setBorderStyle] = useState<BorderStyle>(() => initialDraft?.borderStyle ?? 'solid');
  const [borderColor, setBorderColor] = useState(() => initialDraft?.borderColor ?? textColor);
  const [borderWidth, setBorderWidth] = useState(() => initialDraft?.borderWidth ?? 4);
  const [showStamp, setShowStamp] = useState(() => initialDraft?.showStamp ?? false);
  const [stamp, setStamp] = useState<StampConfig>(() => initialDraft?.stamp ?? createDefaultStamp());
  const [poemPosition, setPoemPosition] = useState<PositionedElement>(() => initialDraft?.poemPosition ?? createDefaultPoemPosition());
  const [initialLayers] = useState(() => normalizeDecorationLayers(
    initialDraft?.customTexts ?? [], initialDraft?.logos ?? [],
  ));
  const [customTexts, setCustomTexts] = useState<CustomText[]>(() => initialLayers.customTexts);
  const [logos, setLogos] = useState<LogoConfig[]>(() => initialLayers.logos);
  const [signatures, setSignatures] = useState<SignatureConfig[]>(() => initialDraft?.signatures ?? []);
  const previousLanguageRef = useRef(language);
  const customTextsRef = useRef(customTexts);
  const logosRef = useRef(logos);
  const signaturesRef = useRef(signatures);

  useEffect(() => {
    customTextsRef.current = customTexts;
  }, [customTexts]);

  useEffect(() => {
    logosRef.current = logos;
  }, [logos]);

  useEffect(() => {
    signaturesRef.current = signatures;
  }, [signatures]);

  useEffect(() => {
    const previousLanguage = previousLanguageRef.current;
    const previousDefaultText = getDefaultStampTextForLanguage(previousLanguage);
    const nextDefaultText = getDefaultStampTextForLanguage(language);

    setStamp((prev) => (prev.text === previousDefaultText
      ? { ...prev, text: nextDefaultText,
        ...(prev.glyphEdits ? {
          glyphEdits: reconcileStampGlyphEdits(prev.text, nextDefaultText, prev.glyphEdits),
        } : {}) }
      : prev));
    previousLanguageRef.current = language;
  }, [language]);

  const addCustomText = () => {
    const nextItem: CustomText = {
      id: Date.now().toString(),
      text: t('defaultCustomText'),
      fontSize: fontSize * 0.8,
      color: textColor,
      writingMode,
      rotation: 0,
      positionX: 50,
      positionY: Math.min(82, 24 + customTextsRef.current.length * 12),
      zIndex: getNextLayerIndex(customTextsRef.current, logosRef.current),
    };

    setCustomTexts((prev) => [...prev, nextItem]);

    onCustomTextAdded?.();
  };

  const updateCustomText = (id: string, updates: Partial<CustomText>) => {
    setCustomTexts((prev) => prev.map((customText) => (customText.id === id ? { ...customText, ...updates } : customText)));
  };

  const removeCustomText = (id: string) => {
    setCustomTexts((prev) => prev.filter((customText) => customText.id !== id));
  };

  const addLogo = (imageUrl: string, options: Partial<LogoConfig> = {}) => {
    const nextLogo: LogoConfig = {
      imageUrl,
      positionX: 50,
      positionY: 50,
      size: 100,
      rotation: 0,
      opacity: 1,
      ...options,
      zIndex: getNextLayerIndex(customTextsRef.current, logosRef.current),
      id: crypto.randomUUID(),
    };

    setLogos((prev) => [...prev, nextLogo]);
    return nextLogo.id;
  };

  const updateLogo = (id: string, updates: Partial<LogoConfig>) => {
    setLogos((prev) => prev.map((logo) => (logo.id === id ? { ...logo, ...updates } : logo)));
  };

  const removeLogo = (id: string) => {
    setLogos((prev) => prev.filter((logo) => logo.id !== id));
  };

  const addSignature = () => {
    const nextSignature: SignatureConfig = {
      id: Date.now().toString(),
      text: 'Signature',
      font: DEFAULT_SIGNATURE_FONT,
      color: textColor,
      fontSize: Math.round(fontSize * 1.2),
      slant: -8,
      thickness: 0,
      flourish: 'swoosh',
      positionX: 50,
      positionY: 80,
      opacity: 0.9,
      rotation: 0,
      zIndex: signaturesRef.current.length,
    };
    setSignatures((prev) => [...prev, nextSignature]);
  };

  const updateSignature = (id: string, updates: Partial<SignatureConfig>) => {
    setSignatures((prev) => prev.map((sig) => (sig.id === id ? { ...sig, ...updates } : sig)));
  };

  const removeSignature = (id: string) => {
    setSignatures((prev) => prev.filter((sig) => sig.id !== id));
  };

  const applyLayerUpdate = (nextCustomTexts: CustomText[], nextLogos: LogoConfig[]) => {
    const normalized = normalizeDecorationLayers(nextCustomTexts, nextLogos);
    setCustomTexts(normalized.customTexts);
    setLogos(normalized.logos);
  };

  const reorderCustomText = (id: string, direction: LayerDirection) => {
    const nextState = moveLayer(customTextsRef.current, logosRef.current, 'customText', id, direction);
    applyLayerUpdate(nextState.customTexts, nextState.logos);
  };

  const reorderLogo = (id: string, direction: LayerDirection) => {
    const nextState = moveLayer(customTextsRef.current, logosRef.current, 'logo', id, direction);
    applyLayerUpdate(nextState.customTexts, nextState.logos);
  };

  const updateStamp = (updates: Partial<StampConfig>) => {
    setStamp((prev) => ({
      ...prev,
      ...updates,
      // Any text change reconciles character-bound edits unless the caller
      // already supplied the exact edited list in this single atomic update.
      ...(typeof updates.text === 'string' && updates.text !== prev.text
        && !Object.prototype.hasOwnProperty.call(updates, 'glyphEdits')
        && prev.glyphEdits
        ? { glyphEdits: reconcileStampGlyphEdits(prev.text, updates.text, prev.glyphEdits) }
        : {}),
    }));
  };

  const updatePoemPosition = (updates: Partial<PositionedElement>) => {
    setPoemPosition((prev) => mergePositionUpdate(prev, updates));
  };

  const resetStampPosition = () => {
    setStamp((prev) => ({
      ...prev,
      positionX: 80,
      positionY: 80,
    }));
  };

  const applyDecorationsTemplate = (template: TemplateDecorationsConfig, preserveOrnaments = false) => {
    const placed = preserveOrnaments ? logosRef.current.filter(item => item.ornamentId) : [];
    const placedIds = new Set(placed.map(item => item.id));
    const incoming = (template.logos ?? []).filter(item => !placedIds.has(item.id));
    const normalized = normalizeDecorationLayers(template.customTexts, [...incoming, ...placed]);
    setShowBorder(template.showBorder);
    setBorderStyle(template.borderStyle);
    setBorderColor(template.borderColor ?? textColor);
    setBorderWidth(template.borderWidth ?? 4);
    setShowStamp(template.showStamp);
    setStamp(template.stamp);
    setPoemPosition(template.poemPosition);
    setCustomTexts(normalized.customTexts);
    setLogos(normalized.logos);
    setSignatures(template.signatures ?? []);
  };

  return {
    showBorder,
    borderStyle,
    borderColor,
    borderWidth,
    showStamp,
    stamp,
    poemPosition,
    customTexts,
    logos,
    signatures,
    setShowBorder,
    setBorderStyle,
    setBorderColor,
    setBorderWidth,
    setShowStamp,
    setStamp: updateStamp,
    setPoemPosition: updatePoemPosition,
    resetStampPosition,
    addCustomText,
    updateCustomText,
    removeCustomText,
    onCustomTextReorder: reorderCustomText,
    addLogo,
    updateLogo,
    removeLogo,
    onLogoReorder: reorderLogo,
    addSignature,
    updateSignature,
    removeSignature,
    applyDecorationsTemplate,
  };
}
