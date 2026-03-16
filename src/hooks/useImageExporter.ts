import { useCallback, useState } from 'react';
import { renderCanvasExportBlob } from '../export/renderCanvasExport';
import type { BorderStyle, CustomText, ExportScale, PositionedElement, StampConfig, TextAlign, WritingMode } from '../types';

interface UseImageExporterBackgroundOptions {
  backgroundType: 'solid' | 'gradient' | 'transparent' | 'image' | 'ai';
  backgroundColor: string;
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: string;
  backgroundImage: string | null;
  bgBrightness: number;
  bgBlur: number;
}

interface UseImageExporterTypographyOptions {
  text: string;
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
  poemPosition: PositionedElement;
}

interface UseImageExporterDecorationsOptions {
  showBorder: boolean;
  borderStyle: BorderStyle;
  showStamp: boolean;
  stamp: StampConfig;
  customTexts: CustomText[];
}

interface UseImageExporterSceneOptions {
  canvasWidth: number;
  canvasHeight: number;
  background: UseImageExporterBackgroundOptions;
  typography: UseImageExporterTypographyOptions;
  decorations: UseImageExporterDecorationsOptions;
}

function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = 'poem-image.png';
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function useImageExporter(
  exportScale: ExportScale,
  scene: UseImageExporterSceneOptions,
  waitForSceneSettled: () => Promise<void>,
) {
  const [isExporting, setIsExporting] = useState(false);
  const exportImage = useCallback(async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      await waitForSceneSettled();

      const blob = await renderCanvasExportBlob({
        canvasWidth: scene.canvasWidth,
        canvasHeight: scene.canvasHeight,
        exportScale,
        background: scene.background,
        typography: scene.typography,
        decorations: scene.decorations,
      });

      if (!blob) {
        return;
      }

      downloadBlob(blob);
    } catch (error) {
      console.error('Failed to generate image', error);
    } finally {
      setIsExporting(false);
    }
  }, [exportScale, isExporting, scene, waitForSceneSettled]);

  return { exportImage, isExporting };
}
