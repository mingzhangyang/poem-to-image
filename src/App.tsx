import React, { useState, useRef, useCallback, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { GoogleGenAI } from '@google/genai';
import { 
  Download, Image as ImageIcon, Sparkles, Type, Palette, 
  AlignLeft, AlignCenter, AlignRight, LayoutTemplate, 
  Loader2, Upload, Stamp, Square, Plus, Trash2, ChevronDown, ChevronRight, Maximize
} from 'lucide-react';
import { motion } from 'motion/react';
import { translations, Language, TranslationKey } from './translations';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type BackgroundType = 'solid' | 'gradient' | 'transparent' | 'image' | 'ai';
type WritingMode = 'horizontal-tb' | 'vertical-rl';
type TextAlign = 'left' | 'center' | 'right';

interface CustomText {
  id: string;
  text: string;
  fontSize: number;
  color: string;
  writingMode: WritingMode;
  rotation: number;
}

export default function App() {
  const [language, setLanguage] = useState<Language>('zh-CN');
  const t = (key: TranslationKey) => translations[language][key];

  const [text, setText] = useState('床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。');
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('solid');
  const [backgroundColor, setBackgroundColor] = useState('#f8fafc');
  const [gradientColor1, setGradientColor1] = useState('#e0e7ff');
  const [gradientColor2, setGradientColor2] = useState('#ede9fe');
  const [gradientDirection, setGradientDirection] = useState('to bottom right');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [bgBrightness, setBgBrightness] = useState(100);
  const [bgBlur, setBgBlur] = useState(0);
  
  const [fontFamily, setFontFamily] = useState('"Noto Serif SC", serif');
  const [fontSize, setFontSize] = useState(32);
  const [textColor, setTextColor] = useState('#1e293b');
  const [textAlign, setTextAlign] = useState<TextAlign>('center');
  const [writingMode, setWritingMode] = useState<WritingMode>('horizontal-tb');
  const [padding, setPadding] = useState(64);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [letterSpacing, setLetterSpacing] = useState(4);
  const [columns, setColumns] = useState(1);
  const [columnGap, setColumnGap] = useState(32);
  
  const [textShadowEnabled, setTextShadowEnabled] = useState(false);
  const [textShadowColor, setTextShadowColor] = useState('#000000');
  const [textShadowBlur, setTextShadowBlur] = useState(10);
  const [textShadowOffsetY, setTextShadowOffsetY] = useState(2);
  const [textShadowOffsetX, setTextShadowOffsetX] = useState(0);

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiError, setAiError] = useState('');

  const [showBorder, setShowBorder] = useState(false);
  const [borderStyle, setBorderStyle] = useState<'solid' | 'dashed' | 'double'>('solid');
  const [showStamp, setShowStamp] = useState(false);
  const [stampText, setStampText] = useState('印');

  const [canvasWidth, setCanvasWidth] = useState(1080);
  const [canvasHeight, setCanvasHeight] = useState(1440);
  const [presetSize, setPresetSize] = useState('1080x1440');

  const [customTexts, setCustomTexts] = useState<CustomText[]>([]);

  const [expandedSections, setExpandedSections] = useState({
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

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const addCustomText = () => {
    setCustomTexts([
      ...customTexts,
      {
        id: Date.now().toString(),
        text: t('defaultCustomText'),
        fontSize: fontSize * 0.8,
        color: textColor,
        writingMode: writingMode,
        rotation: 0,
      }
    ]);
    setExpandedSections(prev => ({ ...prev, decorations: true }));
  };

  const updateCustomText = (id: string, updates: Partial<CustomText>) => {
    setCustomTexts(customTexts.map(ct => ct.id === id ? { ...ct, ...updates } : ct));
  };

  const removeCustomText = (id: string) => {
    setCustomTexts(customTexts.filter(ct => ct.id !== id));
  };

  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const availableWidth = clientWidth - 64; // 32px padding on each side
        const availableHeight = clientHeight - 64;
        
        const scaleX = availableWidth / canvasWidth;
        const scaleY = availableHeight / canvasHeight;
        
        setScale(Math.min(scaleX, scaleY, 1)); // Don't scale up beyond 1
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [canvasWidth, canvasHeight]);

  const handleDownload = useCallback(() => {
    if (previewRef.current === null) {
      return;
    }

    toPng(previewRef.current, { 
      cacheBust: true, 
      pixelRatio: 2,
      canvasWidth: canvasWidth,
      canvasHeight: canvasHeight,
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left'
      }
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'poem-image.png';
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Failed to generate image', err);
      });
  }, [previewRef, canvasWidth, canvasHeight]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBackgroundImage(event.target?.result as string);
        setBackgroundType('image');
      };
      reader.readAsDataURL(file);
    }
  };

  const generateAIBackground = async () => {
    if (!text && !aiPrompt) {
      setAiError(t('errNoPrompt'));
      return;
    }

    setIsGeneratingAI(true);
    setAiError('');
    
    try {
      const prompt = aiPrompt || `A beautiful, atmospheric, and minimalist background image suitable for a poem. The poem is: "${text}". The image should have plenty of empty space for text, and match the mood of the poem. No text in the image.`;
      
      let aspectRatio = "1:1";
      const ratio = canvasWidth / canvasHeight;
      if (ratio > 1.5) aspectRatio = "16:9";
      else if (ratio > 1.1) aspectRatio = "4:3";
      else if (ratio < 0.6) aspectRatio = "9:16";
      else if (ratio < 0.9) aspectRatio = "3:4";

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            { text: prompt },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: "1K"
          }
        }
      });

      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          const imageUrl = `data:${part.inlineData.mimeType};base64,${base64EncodeString}`;
          setBackgroundImage(imageUrl);
          setBackgroundType('ai');
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        setAiError(t('errNoImage'));
      }
    } catch (error: any) {
      console.error('AI Generation Error:', error);
      setAiError(error.message || t('errGenFailed'));
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const getBackgroundStyle = () => {
    switch (backgroundType) {
      case 'solid':
        return { backgroundColor };
      case 'gradient':
        return { backgroundImage: `linear-gradient(${gradientDirection}, ${gradientColor1}, ${gradientColor2})` };
      case 'transparent':
        return { backgroundColor: 'transparent' };
      case 'image':
      case 'ai':
        return { 
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        };
      default:
        return { backgroundColor };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans text-gray-800">
      {/* Sidebar Controls */}
      <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col h-screen overflow-y-auto shrink-0 shadow-sm z-10">
        <div className="p-6 border-b border-gray-100 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-indigo-900">
              <Sparkles className="w-6 h-6 text-indigo-500" />
              {t('appTitle')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
          </div>
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="text-xs border border-gray-200 rounded-md text-gray-600 p-1 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <option value="en">EN</option>
            <option value="zh-CN">简</option>
            <option value="zh-TW">繁</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
            <option value="es">ES</option>
            <option value="fr">FR</option>
            <option value="de">DE</option>
          </select>
        </div>

        <div className="p-6 space-y-8 flex-1">
          {/* Canvas Size Section */}
          <section className="space-y-3">
            <button 
              onClick={() => toggleSection('canvasSize')}
              className="w-full flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span className="flex items-center gap-2"><Maximize className="w-4 h-4" /> {t('canvasSize')}</span>
              {expandedSections.canvasSize ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {expandedSections.canvasSize && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('presetSizes')}</label>
                  <select
                    value={presetSize}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="1080x1080">1:1 (1080x1080)</option>
                    <option value="1080x1440">3:4 (1080x1440)</option>
                    <option value="1440x1080">4:3 (1440x1080)</option>
                    <option value="1080x1920">9:16 (1080x1920)</option>
                    <option value="1920x1080">16:9 (1920x1080)</option>
                    <option value="1240x1754">A4 (1240x1754)</option>
                    <option value="custom">{t('customSize')}</option>
                  </select>
                </div>
                
                {presetSize === 'custom' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{t('width')} (px)</label>
                      <input
                        type="number"
                        min="100"
                        max="4000"
                        value={canvasWidth}
                        onChange={(e) => setCanvasWidth(Number(e.target.value))}
                        className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{t('height')} (px)</label>
                      <input
                        type="number"
                        min="100"
                        max="4000"
                        value={canvasHeight}
                        onChange={(e) => setCanvasHeight(Number(e.target.value))}
                        className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Text Input Section */}
          <section className="space-y-3">
            <button 
              onClick={() => toggleSection('content')}
              className="w-full flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span className="flex items-center gap-2"><Type className="w-4 h-4" /> {t('content')}</span>
              {expandedSections.content ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {expandedSections.content && (
              <textarea
                className="w-full h-32 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none text-sm"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('enterPoem')}
              />
            )}
          </section>

          {/* Background Section */}
          <section className="space-y-4">
            <button 
              onClick={() => toggleSection('background')}
              className="w-full flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span className="flex items-center gap-2"><Palette className="w-4 h-4" /> {t('background')}</span>
              {expandedSections.background ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            
            {expandedSections.background && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {(['solid', 'gradient', 'transparent', 'image', 'ai'] as BackgroundType[]).map((type) => {
                    const typeMap: Record<BackgroundType, TranslationKey> = {
                      solid: 'bgSolid',
                      gradient: 'bgGradient',
                      transparent: 'bgTransparent',
                      image: 'bgImage',
                      ai: 'bgAI'
                    };
                    return (
                      <button
                        key={type}
                        onClick={() => setBackgroundType(type)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                          backgroundType === type 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {t(typeMap[type])}
                      </button>
                    );
                  })}
                </div>

                {backgroundType === 'solid' && (
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                    />
                    <span className="text-sm text-gray-600 uppercase font-mono">{backgroundColor}</span>
                  </div>
                )}

                {backgroundType === 'gradient' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={gradientColor1}
                        onChange={(e) => setGradientColor1(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                      />
                      <input
                        type="color"
                        value={gradientColor2}
                        onChange={(e) => setGradientColor2(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                      />
                    </div>
                    <select
                      value={gradientDirection}
                      onChange={(e) => setGradientDirection(e.target.value)}
                      className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="to right">{t('gradLTR')}</option>
                      <option value="to bottom">{t('gradTTB')}</option>
                      <option value="to bottom right">{t('gradTLBR')}</option>
                      <option value="to top right">{t('gradBLTR')}</option>
                    </select>
                  </div>
                )}

                {backgroundType === 'image' && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      ref={fileInputRef}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 px-4 border border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" /> {t('uploadImage')}
                    </button>
                  </div>
                )}

                {backgroundType === 'ai' && (
                  <div className="space-y-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                    <textarea
                      className="w-full h-20 p-2 text-sm border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder={t('aiPromptPlaceholder')}
                    />
                    <button
                      onClick={generateAIBackground}
                      disabled={isGeneratingAI}
                      className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                    >
                      {isGeneratingAI ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> {t('generating')}</>
                      ) : (
                        <><Sparkles className="w-4 h-4" /> {t('generateAIBg')}</>
                      )}
                    </button>
                    {aiError && <p className="text-xs text-red-500 mt-2">{aiError}</p>}
                  </div>
                )}

                {(backgroundType === 'image' || backgroundType === 'ai') && (
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{t('brightness')}</span>
                        <span>{bgBrightness}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={bgBrightness}
                        onChange={(e) => setBgBrightness(Number(e.target.value))}
                        className="w-full accent-indigo-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{t('blur')}</span>
                        <span>{bgBlur}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={bgBlur}
                        onChange={(e) => setBgBlur(Number(e.target.value))}
                        className="w-full accent-indigo-600"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Typography Section */}
          <section className="space-y-4">
            <button 
              onClick={() => toggleSection('typography')}
              className="w-full flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span className="flex items-center gap-2"><LayoutTemplate className="w-4 h-4" /> {t('typography')}</span>
              {expandedSections.typography ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            
            {expandedSections.typography && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('fontFamily')}</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value='"Noto Serif SC", serif'>Serif (宋体/明朝)</option>
                    <option value='"Noto Sans SC", sans-serif'>Sans Serif (黑体)</option>
                    <option value='"Ma Shan Zheng", cursive'>Ma Shan Zheng (手写楷体)</option>
                    <option value='"Zhi Mang Xing", cursive'>Zhi Mang Xing (手写行书)</option>
                    <option value='"Liu Jian Mao Cao", cursive'>Liu Jian Mao Cao (手写草书)</option>
                    <option value='"Long Cang", cursive'>Long Cang (手写行草)</option>
                    <option value='"ZCOOL XiaoWei", serif'>ZCOOL XiaoWei (小魏碑)</option>
                    <option value='"ZCOOL QingKe HuangYou", cursive'>QingKe HuangYou (站酷黄油)</option>
                    <option value="monospace">Monospace (等宽)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('fontSize')} ({fontSize}px)</label>
                    <input
                      type="range"
                      min="12"
                      max="120"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('padding')} ({padding}px)</label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={padding}
                      onChange={(e) => setPadding(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('lineHeight')} ({lineHeight})</label>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.1"
                      value={lineHeight}
                      onChange={(e) => setLineHeight(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('letterSpacing')} ({letterSpacing}px)</label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={letterSpacing}
                      onChange={(e) => setLetterSpacing(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('columns')} ({columns})</label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      value={columns}
                      onChange={(e) => setColumns(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('columnGap')} ({columnGap}px)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={columnGap}
                      onChange={(e) => setColumnGap(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('textColor')}</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                    />
                    <span className="text-sm text-gray-600 uppercase font-mono">{textColor}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-600 flex items-center gap-2 font-medium">
                      <input 
                        type="checkbox" 
                        checked={textShadowEnabled} 
                        onChange={(e) => setTextShadowEnabled(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      {t('textShadow')}
                    </label>
                  </div>
                  
                  {textShadowEnabled && (
                    <div className="space-y-3 pl-6">
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={textShadowColor}
                          onChange={(e) => setTextShadowColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                        />
                        <span className="text-xs text-gray-500 uppercase font-mono">{textShadowColor}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">{t('blur')} ({textShadowBlur}px)</label>
                          <input
                            type="range"
                            min="0"
                            max="30"
                            value={textShadowBlur}
                            onChange={(e) => setTextShadowBlur(Number(e.target.value))}
                            className="w-full accent-indigo-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">{t('offsetX')} ({textShadowOffsetX}px)</label>
                          <input
                            type="range"
                            min="-20"
                            max="20"
                            value={textShadowOffsetX}
                            onChange={(e) => setTextShadowOffsetX(Number(e.target.value))}
                            className="w-full accent-indigo-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">{t('offsetY')} ({textShadowOffsetY}px)</label>
                          <input
                            type="range"
                            min="-20"
                            max="20"
                            value={textShadowOffsetY}
                            onChange={(e) => setTextShadowOffsetY(Number(e.target.value))}
                            className="w-full accent-indigo-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <div className="flex-1 bg-gray-100 p-1 rounded-lg flex">
                    {(['left', 'center', 'right'] as TextAlign[]).map((align) => (
                      <button
                        key={align}
                        onClick={() => setTextAlign(align)}
                        className={`flex-1 py-1.5 flex justify-center items-center rounded-md transition-all ${
                          textAlign === align ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {align === 'left' && <AlignLeft className="w-4 h-4" />}
                        {align === 'center' && <AlignCenter className="w-4 h-4" />}
                        {align === 'right' && <AlignRight className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 bg-gray-100 p-1 rounded-lg flex">
                    <button
                      onClick={() => setWritingMode('horizontal-tb')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                        writingMode === 'horizontal-tb' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {t('horizontal')}
                    </button>
                    <button
                      onClick={() => setWritingMode('vertical-rl')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                        writingMode === 'vertical-rl' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {t('vertical')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
          {/* Decorations Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => toggleSection('decorations')}
                className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
              >
                <Stamp className="w-4 h-4" /> {t('decorations')}
                {expandedSections.decorations ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <button
                onClick={addCustomText}
                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors flex items-center gap-1 text-xs font-medium"
                title={t('addTextBox')}
              >
                <Plus className="w-3 h-3" /> {t('addTextBox')}
              </button>
            </div>
            
            {expandedSections.decorations && (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600 flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={showBorder} 
                        onChange={(e) => setShowBorder(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      {t('showBorder')}
                    </label>
                    {showBorder && (
                      <select
                        value={borderStyle}
                        onChange={(e) => setBorderStyle(e.target.value as any)}
                        className="p-1 text-xs border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="solid">{t('borderSolid')}</option>
                        <option value="dashed">{t('borderDashed')}</option>
                        <option value="double">{t('borderDouble')}</option>
                      </select>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600 flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={showStamp} 
                        onChange={(e) => setShowStamp(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      {t('showStamp')}
                    </label>
                    {showStamp && (
                      <input
                        type="text"
                        value={stampText}
                        onChange={(e) => setStampText(e.target.value.slice(0, 2))}
                        maxLength={2}
                        className="w-16 p-1 text-xs border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 text-center"
                        placeholder={t('stampText')}
                      />
                    )}
                  </div>
                </div>

                {customTexts.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t('customTexts')}</div>
                    {customTexts.map((ct) => (
                      <div key={ct.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={ct.text}
                            onChange={(e) => updateCustomText(ct.id, { text: e.target.value })}
                            className="flex-1 p-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500"
                            placeholder={t('textContent')}
                          />
                          <button
                            onClick={() => removeCustomText(ct.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={ct.color}
                            onChange={(e) => updateCustomText(ct.id, { color: e.target.value })}
                            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                          />
                          <input
                            type="range"
                            min="12"
                            max="120"
                            value={ct.fontSize}
                            onChange={(e) => updateCustomText(ct.id, { fontSize: Number(e.target.value) })}
                            className="flex-1 accent-indigo-600"
                          />
                          <span className="text-xs text-gray-500 w-8">{ct.fontSize}px</span>
                        </div>
                        <div className="flex gap-1 bg-white p-1 rounded border border-gray-200">
                          <button
                            onClick={() => updateCustomText(ct.id, { writingMode: 'horizontal-tb' })}
                            className={`flex-1 py-1 text-xs rounded transition-colors ${ct.writingMode === 'horizontal-tb' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                          >
                            {t('horiz')}
                          </button>
                          <button
                            onClick={() => updateCustomText(ct.id, { writingMode: 'vertical-rl' })}
                            className={`flex-1 py-1 text-xs rounded transition-colors ${ct.writingMode === 'vertical-rl' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                          >
                            {t('vert')}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-8">{t('angle')}</span>
                          <input
                            type="range"
                            min="-180"
                            max="180"
                            value={ct.rotation || 0}
                            onChange={(e) => updateCustomText(ct.id, { rotation: Number(e.target.value) })}
                            className="flex-1 accent-indigo-600"
                          />
                          <span className="text-xs text-gray-500 w-8 text-right">{ct.rotation || 0}°</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="p-6 border-t border-gray-100 bg-white sticky bottom-0">
          <button
            onClick={handleDownload}
            className="w-full py-3 px-4 bg-gray-900 hover:bg-black text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            <Download className="w-5 h-5" /> {t('exportImage')}
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center p-8 bg-gray-200/50 overflow-hidden relative">
        {/* Checkerboard background for transparent preview */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          opacity: backgroundType === 'transparent' ? 1 : 0,
          transition: 'opacity 0.3s'
        }} />
        
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'center', transition: 'transform 0.2s ease-out' }}>
          <div 
            className="relative shadow-2xl flex items-center justify-center overflow-hidden"
            style={{
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
            }}
          >
            {/* The actual element to capture */}
            <div
              ref={previewRef}
              className="w-full h-full flex items-center justify-center relative overflow-hidden"
              style={{
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`,
                padding: `${padding}px`,
              }}
            >
              {/* Background Layer */}
              <div 
                className="absolute inset-0 z-0"
                style={{
                  ...getBackgroundStyle(),
                  filter: `brightness(${bgBrightness}%) blur(${bgBlur}px)`,
                  transform: bgBlur > 0 ? `scale(1.1)` : 'none'
                }}
              />

            {/* Optional overlay for better text readability on images */}
            {(backgroundType === 'image' || backgroundType === 'ai') && (
              <div className="absolute inset-0 bg-black/10 pointer-events-none z-0" />
            )}
            
            {/* Custom Draggable Texts */}
            {customTexts.map((ct) => (
              <motion.div
                key={ct.id}
                drag
                dragMomentum={false}
                className="absolute cursor-move whitespace-pre-wrap break-words"
                style={{
                  fontFamily,
                  fontSize: `${ct.fontSize}px`,
                  color: ct.color,
                  writingMode: ct.writingMode,
                  lineHeight,
                  letterSpacing: `${letterSpacing}px`,
                  textShadow: textShadowEnabled ? `${textShadowOffsetX}px ${textShadowOffsetY}px ${textShadowBlur}px ${textShadowColor}` : 'none',
                  zIndex: 50,
                  rotate: ct.rotation || 0,
                }}
              >
                {ct.text}
              </motion.div>
            ))}

            <div
              className={`relative z-10 flex flex-col items-center justify-center w-full h-full ${showBorder ? 'border-4' : ''}`}
              style={{
                borderColor: textColor,
                borderStyle: showBorder ? borderStyle : 'none',
                padding: showBorder ? '2rem' : '0',
              }}
            >
              <motion.div
                drag
                dragMomentum={false}
                className="flex flex-col items-center justify-center cursor-move"
              >
                <div
                  className="whitespace-pre-wrap break-words max-w-full"
                  style={{
                    fontFamily,
                    fontSize: `${fontSize}px`,
                    color: textColor,
                    textAlign,
                    writingMode,
                    lineHeight,
                    letterSpacing: `${letterSpacing}px`,
                    textShadow: textShadowEnabled ? `${textShadowOffsetX}px ${textShadowOffsetY}px ${textShadowBlur}px ${textShadowColor}` : 'none',
                    columnCount: columns,
                    columnGap: `${columnGap}px`,
                  }}
                >
                  {text || t('poemPlaceholder')}
                </div>
                
                {showStamp && (
                  <div 
                    className="mt-8 border-2 rounded-sm flex items-center justify-center font-bold"
                    style={{
                      borderColor: '#dc2626', // red-600
                      color: '#dc2626',
                      width: `${fontSize * 1.5}px`,
                      height: `${fontSize * 1.5}px`,
                      fontSize: `${fontSize * 0.8}px`,
                      fontFamily: '"Ma Shan Zheng", cursive',
                      writingMode: 'horizontal-tb',
                      opacity: 0.8,
                      transform: 'rotate(-5deg)',
                      alignSelf: writingMode === 'vertical-rl' ? 'flex-end' : 'auto'
                    }}
                  >
                    {stampText}
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

