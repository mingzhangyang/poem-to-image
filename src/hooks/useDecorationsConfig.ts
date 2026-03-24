import { useEffect, useRef, useState } from 'react';
import { DEFAULT_STAMP_FONT } from '../fontOptions';
import { getDefaultStampTextForLanguage } from '../stampDefaults';
import { DEFAULT_SIGNATURE_FONT } from '../signatureRendering';
import type { Language } from '../translations';
import type { BorderStyle, CustomText, LogoConfig, PositionedElement, SignatureConfig, StampConfig, TemplateDecorationsConfig, TranslateFn, WritingMode } from '../types';

type LayerDirection = 'up' | 'down' | 'top' | 'bottom';
type LayerKind = 'customText' | 'logo';

function buildOrderedLayers(customTexts: CustomText[], logos: LogoConfig[]) {
  return [
    ...customTexts.map((item, index) => ({
      id: item.id,
      kind: 'customText' as const,
      zIndex: item.zIndex ?? index,
      order: index,
    })),
    ...logos.map((item, index) => ({
      id: item.id,
      kind: 'logo' as const,
      zIndex: item.zIndex ?? customTexts.length + index,
      order: customTexts.length + index,
    })),
  ].sort((left, right) => (left.zIndex - right.zIndex) || (left.order - right.order));
}

function normalizeDecorationLayers(customTexts: CustomText[], logos: LogoConfig[]) {
  const layerMap = new Map(
    buildOrderedLayers(customTexts, logos).map((item, index) => [`${item.kind}:${item.id}`, index]),
  );

  return {
    customTexts: customTexts.map((item) => ({
      ...item,
      zIndex: layerMap.get(`customText:${item.id}`) ?? 0,
    })),
    logos: logos.map((item) => ({
      ...item,
      zIndex: layerMap.get(`logo:${item.id}`) ?? 0,
    })),
  };
}

function getNextLayerIndex(customTexts: CustomText[], logos: LogoConfig[]) {
  const orderedLayers = buildOrderedLayers(customTexts, logos);
  return orderedLayers.length === 0 ? 0 : orderedLayers[orderedLayers.length - 1].zIndex + 1;
}

function moveLayer(
  customTexts: CustomText[],
  logos: LogoConfig[],
  targetKind: LayerKind,
  targetId: string,
  direction: LayerDirection,
) {
  const orderedLayers = buildOrderedLayers(customTexts, logos);
  const currentIndex = orderedLayers.findIndex((item) => item.kind === targetKind && item.id === targetId);

  if (currentIndex === -1) {
    return normalizeDecorationLayers(customTexts, logos);
  }

  const reordered = [...orderedLayers];
  const [target] = reordered.splice(currentIndex, 1);

  if (direction === 'top') {
    reordered.push(target);
  } else if (direction === 'bottom') {
    reordered.unshift(target);
  } else if (direction === 'up') {
    reordered.splice(Math.min(reordered.length, currentIndex + 1), 0, target);
  } else {
    reordered.splice(Math.max(0, currentIndex - 1), 0, target);
  }

  const layerMap = new Map(reordered.map((item, index) => [`${item.kind}:${item.id}`, index]));

  return {
    customTexts: customTexts.map((item) => ({
      ...item,
      zIndex: layerMap.get(`customText:${item.id}`) ?? item.zIndex ?? 0,
    })),
    logos: logos.map((item) => ({
      ...item,
      zIndex: layerMap.get(`logo:${item.id}`) ?? item.zIndex ?? 0,
    })),
  };
}

interface UseDecorationsConfigParams {
  language: Language;
  t: TranslateFn;
  fontSize: number;
  textColor: string;
  writingMode: WritingMode;
  onCustomTextAdded?: () => void;
}

export function useDecorationsConfig({
  language,
  t,
  fontSize,
  textColor,
  writingMode,
  onCustomTextAdded,
}: UseDecorationsConfigParams) {
  const createDefaultPoemPosition = (): PositionedElement => ({
    positionX: 50,
    positionY: 50,
  });

  const createDefaultStamp = (): StampConfig => ({
    text: getDefaultStampTextForLanguage(language),
    style: 'square',
    colorScheme: 'filled',
    inkColor: '#c82829',
    weathering: 50,
    positionX: 80,
    positionY: 80,
    size: Math.round(fontSize * 2.5),
    rotation: -8,
    opacity: 0.82,
    fontFamily: DEFAULT_STAMP_FONT,
  });

  const [showBorder, setShowBorder] = useState(false);
  const [borderStyle, setBorderStyle] = useState<BorderStyle>('solid');
  const [borderColor, setBorderColor] = useState(textColor);
  const [borderWidth, setBorderWidth] = useState(4);
  const [showStamp, setShowStamp] = useState(false);
  const [stamp, setStamp] = useState<StampConfig>(() => createDefaultStamp());
  const [poemPosition, setPoemPosition] = useState<PositionedElement>(() => createDefaultPoemPosition());
  const [customTexts, setCustomTexts] = useState<CustomText[]>([]);
  const [logos, setLogos] = useState<LogoConfig[]>([]);
  const [signatures, setSignatures] = useState<SignatureConfig[]>([]);
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

    setStamp((prev) => (prev.text === previousDefaultText ? { ...prev, text: nextDefaultText } : prev));
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

  const addLogo = (imageUrl: string) => {
    const nextLogo: LogoConfig = {
      id: Date.now().toString(),
      imageUrl,
      positionX: 50,
      positionY: 50,
      size: 100,
      rotation: 0,
      opacity: 1,
      zIndex: getNextLayerIndex(customTextsRef.current, logosRef.current),
    };

    setLogos((prev) => [...prev, nextLogo]);
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
    setStamp((prev) => ({ ...prev, ...updates }));
  };

  const updatePoemPosition = (updates: Partial<PositionedElement>) => {
    setPoemPosition((prev) => ({ ...prev, ...updates }));
  };

  const resetStampPosition = () => {
    setStamp((prev) => ({
      ...prev,
      positionX: 80,
      positionY: 80,
    }));
  };

  const applyDecorationsTemplate = (template: TemplateDecorationsConfig) => {
    const normalized = normalizeDecorationLayers(template.customTexts, template.logos || []);
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
