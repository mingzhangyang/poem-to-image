import { Stamp } from 'lucide-react';
import type { BorderStyle, DecorationsSectionProps, ExpandedSections, TranslateFn } from '../../types';
import { ControlSection } from '../ControlSection';
import { AddElementActions } from './AddElementActions';
import { BorderControls } from './BorderControls';
import { CustomTextList } from './CustomTextList';
import { LogoList } from './LogoList';
import { OrnamentLibrary } from './OrnamentLibrary';
import { SealControls } from './SealControls';
import { SignatureList } from './SignatureList';

const BORDER_STYLE_LABELS: Record<
  BorderStyle,
  | 'borderSolid'
  | 'borderDashed'
  | 'borderDouble'
  | 'borderShadow'
  | 'borderGradient'
  | 'borderBroken'
  | 'borderOverflow'
  | 'borderBrush'
  | 'borderInk'
  | 'borderCloud'
  | 'borderWave'
  | 'borderFractal'
  | 'borderMeander'
  | 'borderLeiwen'
  | 'borderOrnamental'
  | 'borderEnvelope'
> = {
  solid: 'borderSolid',
  dashed: 'borderDashed',
  double: 'borderDouble',
  shadow: 'borderShadow',
  gradient: 'borderGradient',
  broken: 'borderBroken',
  overflow: 'borderOverflow',
  brush: 'borderBrush',
  ink: 'borderInk',
  cloud: 'borderCloud',
  wave: 'borderWave',
  fractal: 'borderFractal',
  meander: 'borderMeander',
  leiwen: 'borderLeiwen',
  ornamental: 'borderOrnamental',
  envelope: 'borderEnvelope',
};

interface DecorationsPanelProps {
  t: TranslateFn;
  expanded: ExpandedSections['decorations'];
  onToggle: () => void;
  decorations: DecorationsSectionProps;
}

export function DecorationsPanel({ t, expanded, onToggle, decorations }: DecorationsPanelProps) {
  const ornamentCount = decorations.logos.filter(item => item.ornamentId).length;
  const summaryParts = [
    decorations.showBorder ? t(BORDER_STYLE_LABELS[decorations.borderStyle]) : null,
    decorations.showStamp && decorations.stampSupported ? t('showStamp') : null,
    `${decorations.customTexts.length} ${t('customTexts')}`,
    `${decorations.logos.filter(item => !item.ornamentId).length} ${t('logos')}`,
    ornamentCount > 0 ? `${ornamentCount} ${t('ornaments')}` : null,
    decorations.signatures.length > 0 ? `${decorations.signatures.length} ${t('signatures')}` : null,
  ].filter(Boolean);

  return (
    <ControlSection
      title={t('decorations')}
      icon={<Stamp className="w-4 h-4" />}
      tint="var(--app-cat-decorations)"
      expanded={expanded}
      onToggle={onToggle}
      summary={summaryParts.join(' · ')}
    >
      <div className="space-y-4">
        <div className="app-soft-surface p-3 rounded-lg space-y-3">
          <BorderControls t={t} decorations={decorations} />
          <SealControls t={t} decorations={decorations} />
        </div>

        <AddElementActions t={t} decorations={decorations} />
        <OrnamentLibrary t={t} decorations={decorations} />
        <CustomTextList t={t} decorations={decorations} />
        <LogoList t={t} decorations={decorations} />
        <SignatureList t={t} decorations={decorations} />
      </div>
    </ControlSection>
  );
}
