import { useCallback, useMemo, useState } from 'react';
import { logError } from '../logger';
import { renderCanvasExport } from '../export/renderCanvasExport';
import { createExportFilename } from '../export/exportFilename';
import type { BorderStyle, CustomText, ExportFormat, ExportScale, LogoConfig, PoemContentData, PoemLayerStyle, PositionedElement, SignatureConfig, SocialPlatform, StampConfig, TextAlign, WritingMode } from '../types';

interface SocialPlatformConfig {
  format: ExportFormat;
  scale: ExportScale;
  url: string | null;
}

interface BatchExportPreset {
  id: string;
  sceneLabel: string;
  width: number;
  height: number;
}

const SOCIAL_PLATFORM_CONFIG: Record<SocialPlatform, SocialPlatformConfig> = {
  wechat:       { format: 'jpg', scale: 2, url: null },
  weibo:        { format: 'jpg', scale: 2, url: 'https://weibo.com/' },
  xiaohongshu:  { format: 'jpg', scale: 2, url: 'https://creator.xiaohongshu.com/publish/publish' },
  twitter:      { format: 'jpg', scale: 2, url: 'https://x.com/intent/tweet' },
  instagram:    { format: 'jpg', scale: 2, url: 'https://www.instagram.com/' },
  facebook:     { format: 'jpg', scale: 2, url: 'https://www.facebook.com/' },
};

async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write) {
    return false;
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

interface UseImageExporterBackgroundOptions {
  backgroundType: 'solid' | 'gradient' | 'transparent' | 'image' | 'ai';
  backgroundColor: string;
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: string;
  backgroundImage: string | null;
  backgroundSize: 'cover' | 'contain' | 'stretch';
  bgBrightness: number;
  bgBlur: number;
}

interface UseImageExporterTypographyOptions {
  poem: PoemContentData;
  poemStyle: PoemLayerStyle;
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
  logos: LogoConfig[];
  signatures: SignatureConfig[];
  borderColor: string;
  borderWidth: number;
}

interface UseImageExporterSceneOptions {
  canvasWidth: number;
  canvasHeight: number;
  background: UseImageExporterBackgroundOptions;
  typography: UseImageExporterTypographyOptions;
  decorations: UseImageExporterDecorationsOptions;
}

function getExportMimeType(format: ExportFormat) {
  if (format === 'jpg') {
    return 'image/jpeg';
  }

  if (format === 'webp') {
    return 'image/webp';
  }

  return 'image/png';
}

function getExportFilename(format: ExportFormat, title = '', suffix = '') {
  return createExportFilename(title, format, new Date(), suffix);
}

function createOpaqueCanvasCopy(sourceCanvas: HTMLCanvasElement, fillStyle: string) {
  const opaqueCanvas = document.createElement('canvas');
  opaqueCanvas.width = sourceCanvas.width;
  opaqueCanvas.height = sourceCanvas.height;

  const opaqueContext = opaqueCanvas.getContext('2d');

  if (!opaqueContext) {
    return sourceCanvas;
  }

  opaqueContext.fillStyle = fillStyle;
  opaqueContext.fillRect(0, 0, opaqueCanvas.width, opaqueCanvas.height);
  opaqueContext.drawImage(sourceCanvas, 0, 0);

  return opaqueCanvas;
}

function exportCanvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat) {
  const mimeType = getExportMimeType(format);
  const sourceCanvas = format === 'jpg' ? createOpaqueCanvasCopy(canvas, '#ffffff') : canvas;
  const quality = format === 'png' ? undefined : 0.92;

  return new Promise<Blob | null>((resolve) => {
    sourceCanvas.toBlob(resolve, mimeType, quality);
  });
}

interface SaveFileHandle {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

interface WindowWithSaveFilePicker extends Window {
  showSaveFilePicker: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<SaveFileHandle>;
}

async function saveBlob(blob: Blob, format: ExportFormat, title: string): Promise<boolean> {
  const filename = getExportFilename(format, title);
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as WindowWithSaveFilePicker).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'Image',
            accept: {
              [getExportMimeType(format)]: [`.${format}`],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return false;
      }
      logError('Failed to save via File System Access API, falling back to download', error);
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function supportsFileShare() {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof File === 'undefined') {
    return false;
  }

  if (typeof navigator.canShare !== 'function') {
    return true;
  }

  try {
    const probeFile = new File(['share'], 'share-test.png', { type: 'image/png' });
    return navigator.canShare({ files: [probeFile] });
  } catch {
    return false;
  }
}

export function useImageExporter(
  exportFormat: ExportFormat,
  exportScale: ExportScale,
  scene: UseImageExporterSceneOptions,
  waitForSceneSettled: () => Promise<void>,
) {
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const canShare = useMemo(() => supportsFileShare(), []);

  const renderOutputCanvas = useCallback(async (options?: { scale?: ExportScale; canvasWidth?: number; canvasHeight?: number }) => {
    await waitForSceneSettled();

    const effectiveScale = options?.scale ?? exportScale;
    const exportScene = {
      canvasWidth: options?.canvasWidth ?? scene.canvasWidth,
      canvasHeight: options?.canvasHeight ?? scene.canvasHeight,
      exportScale: effectiveScale,
      background: scene.background,
      typography: scene.typography,
      decorations: scene.decorations,
    };
    return renderCanvasExport(exportScene);
  }, [exportScale, scene, waitForSceneSettled]);

  const createOutputBlob = useCallback(async (
    overrideFormat?: ExportFormat,
    options?: { scale?: ExportScale; canvasWidth?: number; canvasHeight?: number },
  ) => {
    const canvas = await renderOutputCanvas(options);
    return exportCanvasToBlob(canvas, overrideFormat ?? exportFormat);
  }, [exportFormat, renderOutputCanvas]);

  const exportImage = useCallback(async (): Promise<boolean> => {
    if (isExporting || isSharing) {
      return false;
    }

    setIsExporting(true);

    try {
      const blob = await createOutputBlob();

      if (!blob) {
        return false;
      }

      return await saveBlob(blob, exportFormat, scene.typography.poem.title);
    } catch (error) {
      logError('Failed to generate image', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, [createOutputBlob, exportFormat, isExporting, isSharing, scene.typography.poem.title]);

  const copyImage = useCallback(async (): Promise<'clipboard' | 'downloaded' | 'cancelled'> => {
    if (isExporting || isSharing) {
      return 'cancelled';
    }

    setIsSharing(true);
    let pendingBlob: Promise<Blob | null> | null = null;
    const getPngBlob = () => {
      pendingBlob ??= createOutputBlob('png');
      return pendingBlob;
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        try {
          // Supply a pending PNG blob to ClipboardItem synchronously, while the
          // button's user activation is available (notably on Safari).
          const item = new ClipboardItem({
            'image/png': getPngBlob().then((blob) => {
              if (!blob) throw new Error('Unable to render PNG for clipboard');
              return blob;
            }),
          });
          await navigator.clipboard.write([item]);
          return 'clipboard';
        } catch (error) {
          logError('Clipboard copy unavailable, saving PNG instead', error);
        }
      }

      const blob = await getPngBlob();
      if (!blob) {
        return 'cancelled';
      }
      // A clipboard fallback must not open the File System Access picker:
      // it may lose user activation while the PNG is being rendered.
      downloadBlob(blob, getExportFilename('png', scene.typography.poem.title.trim() || 'poem-image'));
      return 'downloaded';
    } catch (error) {
      logError('Failed to copy or download image', error);
      return 'cancelled';
    } finally {
      setIsSharing(false);
    }
  }, [createOutputBlob, isExporting, isSharing, scene.typography.poem.title]);

  const shareImage = useCallback(async () => {
    if (!canShare || isExporting || isSharing) {
      return;
    }

    setIsSharing(true);

    try {
      const blob = await createOutputBlob();

      if (!blob) {
        return;
      }

      const file = new File([blob], getExportFilename(exportFormat, scene.typography.poem.title), { type: getExportMimeType(exportFormat) });
      await navigator.share({
        files: [file],
        title: document.title,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      logError('Failed to share image', error);
    } finally {
      setIsSharing(false);
    }
  }, [canShare, createOutputBlob, exportFormat, isExporting, isSharing, scene.typography.poem.title]);

  const shareToSocialPlatform = useCallback(async (platform: SocialPlatform): Promise<'clipboard' | 'downloaded' | 'cancelled'> => {
    if (isExporting || isSharing) {
      return 'downloaded';
    }

    setIsSharing(true);

    try {
      const { format, scale, url } = SOCIAL_PLATFORM_CONFIG[platform];
      const blob = await createOutputBlob(format, { scale });

      if (!blob) {
        return 'downloaded';
      }

      const copied = await copyImageToClipboard(blob);

      if (!copied) {
        const saved = await saveBlob(blob, format, scene.typography.poem.title);
        if (!saved) {
          return 'cancelled';
        }
      }

      if (url) {
        setTimeout(() => {
          window.open(url, '_blank', 'noopener,noreferrer');
        }, 400);
      }

      return copied ? 'clipboard' : 'downloaded';
    } catch (error) {
      logError('Failed to share to social platform', error);
      return 'downloaded';
    } finally {
      setIsSharing(false);
    }
  }, [createOutputBlob, isExporting, isSharing, scene.typography.poem.title]);

  const exportBatchImages = useCallback(async (presets: BatchExportPreset[]): Promise<number> => {
    if (isExporting || isSharing || presets.length === 0) {
      return 0;
    }

    setIsExporting(true);

    try {
      let completed = 0;

      for (const preset of presets) {
        const blob = await createOutputBlob(exportFormat, {
          scale: exportScale,
          canvasWidth: preset.width,
          canvasHeight: preset.height,
        });

        if (!blob) {
          continue;
        }

        const safePresetId = preset.id.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
        downloadBlob(blob, getExportFilename(exportFormat, scene.typography.poem.title, `${safePresetId}-${preset.width}x${preset.height}`));
        completed += 1;

        // Stagger file downloads to reduce browser drop-off on large batches.
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }

      return completed;
    } catch (error) {
      logError('Failed to batch export images', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, [createOutputBlob, exportFormat, exportScale, isExporting, isSharing, scene.typography.poem.title]);

  return { exportImage, exportBatchImages, shareImage, copyImage, shareToSocialPlatform, isExporting, isSharing, canShare };
}
