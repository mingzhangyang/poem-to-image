import type { SidebarProps } from '../types';
import { BackgroundPanel } from './sidebar/BackgroundPanel';
import { CanvasSizePanel } from './sidebar/CanvasSizePanel';
import { ContentPanel } from './sidebar/ContentPanel';
import { DecorationsPanel } from './sidebar/DecorationsPanel';
import { SidebarFooter } from './sidebar/SidebarFooter';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { TemplatesPanel } from './sidebar/TemplatesPanel';
import { TypographyPanel } from './sidebar/TypographyPanel';

export function Sidebar({
  language,
  onLanguageChange,
  t,
  expandedSections,
  onToggleSection,
  templates,
  canvas,
  content,
  background,
  typography,
  decorations,
  exportScale,
  onExportScaleChange,
  onDownload,
}: SidebarProps) {
  return (
    <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col h-screen overflow-y-auto shrink-0 shadow-sm z-10">
      <SidebarHeader language={language} onLanguageChange={onLanguageChange} t={t} />

      <div className="p-6 space-y-8 flex-1">
        <TemplatesPanel
          t={t}
          expanded={expandedSections.templates}
          onToggle={() => onToggleSection('templates')}
          templates={templates}
        />

        <CanvasSizePanel
          t={t}
          expanded={expandedSections.canvasSize}
          onToggle={() => onToggleSection('canvasSize')}
          canvas={canvas}
        />

        <ContentPanel
          t={t}
          expanded={expandedSections.content}
          onToggle={() => onToggleSection('content')}
          content={content}
        />

        <BackgroundPanel
          t={t}
          expanded={expandedSections.background}
          onToggle={() => onToggleSection('background')}
          background={background}
        />

        <TypographyPanel
          t={t}
          expanded={expandedSections.typography}
          onToggle={() => onToggleSection('typography')}
          typography={typography}
        />

        <DecorationsPanel
          t={t}
          expanded={expandedSections.decorations}
          onToggle={() => onToggleSection('decorations')}
          decorations={decorations}
        />
      </div>

      <SidebarFooter
        t={t}
        exportScale={exportScale}
        onExportScaleChange={onExportScaleChange}
        onDownload={onDownload}
      />
    </div>
  );
}