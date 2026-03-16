import { useRef, useState } from 'react';
import { translations, Language, TranslationKey } from './translations';
import { CanvasPreview } from './components/CanvasPreview';
import { Sidebar } from './components/Sidebar';
import { useBackgroundConfig } from './hooks/useBackgroundConfig';
import { useCanvasScale } from './hooks/useCanvasScale';
import { useDecorationsConfig } from './hooks/useDecorationsConfig';
import { useEditorViewModels } from './hooks/useEditorViewModels';
import { useImageExporter } from './hooks/useImageExporter';
import { useTypographyConfig } from './hooks/useTypographyConfig';
import type { ExpandedSections } from './types';

export default function App() {
  const [language, setLanguage] = useState<Language>('zh-CN');
  const t = (key: TranslationKey) => translations[language][key];

  const [text, setText] = useState('床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。');

  const [canvasWidth, setCanvasWidth] = useState(1080);
  const [canvasHeight, setCanvasHeight] = useState(1440);
  const [presetSize, setPresetSize] = useState('1080x1440');

  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    canvasSize: true,
    content: true,
    background: true,
    typography: false,
    decorations: false
  });

  const handlePresetChange = (val: string) => {
    setPresetSize(val);
    if (val !== 'custom') {
      const [w, h] = val.split('x').map(Number);
      setCanvasWidth(w);
      setCanvasHeight(h);
    }
  };

  const toggleSection = (section: keyof ExpandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const background = useBackgroundConfig({
    text,
    canvasWidth,
    canvasHeight,
    t,
  });
  const typography = useTypographyConfig();
  const decorations = useDecorationsConfig({
    t,
    fontSize: typography.fontSize,
    textColor: typography.textColor,
    writingMode: typography.writingMode,
    onCustomTextAdded: () => setExpandedSections((prev) => ({ ...prev, decorations: true })),
  });

  const scale = useCanvasScale(containerRef, canvasWidth, canvasHeight);
  const handleDownload = useImageExporter(previewRef, canvasWidth, canvasHeight);

  const { sidebarProps, canvasPreviewProps } = useEditorViewModels({
    language,
    onLanguageChange: setLanguage,
    t,
    expandedSections,
    onToggleSection: toggleSection,
    canvas: {
      presetSize,
      canvasWidth,
      canvasHeight,
      onPresetChange: handlePresetChange,
      onCanvasWidthChange: setCanvasWidth,
      onCanvasHeightChange: setCanvasHeight,
    },
    content: {
      text,
      onTextChange: setText,
    },
    background: {
      backgroundType: background.backgroundType,
      backgroundColor: background.backgroundColor,
      gradientColor1: background.gradientColor1,
      gradientColor2: background.gradientColor2,
      gradientDirection: background.gradientDirection,
      backgroundImage: background.backgroundImage,
      bgBrightness: background.bgBrightness,
      bgBlur: background.bgBlur,
      aiPrompt: background.aiPrompt,
      aiError: background.aiError,
      isGeneratingAI: background.isGeneratingAI,
      fileInputRef: background.fileInputRef,
      onBackgroundTypeChange: background.setBackgroundType,
      onBackgroundColorChange: background.setBackgroundColor,
      onGradientColor1Change: background.setGradientColor1,
      onGradientColor2Change: background.setGradientColor2,
      onGradientDirectionChange: background.setGradientDirection,
      onImageUpload: background.onImageUpload,
      onAiPromptChange: background.setAiPrompt,
      onGenerateAiBackground: background.onGenerateAiBackground,
      onBgBrightnessChange: background.setBgBrightness,
      onBgBlurChange: background.setBgBlur,
    },
    typography,
    decorations: {
      showBorder: decorations.showBorder,
      borderStyle: decorations.borderStyle,
      showStamp: decorations.showStamp,
      stampText: decorations.stampText,
      customTexts: decorations.customTexts,
      onAddCustomText: decorations.addCustomText,
      onShowBorderChange: decorations.setShowBorder,
      onBorderStyleChange: decorations.setBorderStyle,
      onShowStampChange: decorations.setShowStamp,
      onStampTextChange: decorations.setStampText,
      onCustomTextChange: decorations.updateCustomText,
      onCustomTextRemove: decorations.removeCustomText,
    },
    onDownload: handleDownload,
    containerRef,
    previewRef,
    text,
    backgroundType: background.backgroundType,
    backgroundStyle: background.backgroundStyle,
    bgBrightness: background.bgBrightness,
    bgBlur: background.bgBlur,
    showBorder: decorations.showBorder,
    borderStyle: decorations.borderStyle,
    showStamp: decorations.showStamp,
    stampText: decorations.stampText,
    canvasWidth,
    canvasHeight,
    customTexts: decorations.customTexts,
    scale,
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans text-gray-800">
      <Sidebar {...sidebarProps} />

      <CanvasPreview {...canvasPreviewProps} />
    </div>
  );
}

