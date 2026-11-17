import {
  CNS_SEAL_FONT_STACK,
  CHONGXI_SEAL_FONT_STACK, JINWEN_FONT_STACK, CLERICAL_FONT_STACK,
} from './sealTypography';

/** One whole-seal face at a time, independently checked against its binary cmap. */
export interface VerifiedSealFont {
  value: string;
  family: string;
  url: string;
  label: string;
}
export const VERIFIED_SEAL_FONTS: readonly VerifiedSealFont[] = [
  { value: CNS_SEAL_FONT_STACK, family: 'InkPoem CNS Seal', url: '/fonts/CNS-Seal.ttf', label: '全字库说文解字' },
  { value: CLERICAL_FONT_STACK, family: 'InkPoem MOE Li', url: '/fonts/MOE-Li.ttf', label: '教育部隶书' },
  { value: JINWEN_FONT_STACK, family: 'InkPoem Chine-Culture Jinwen', url: '/fonts/Chine-Culture-Jinwen.otf', label: 'Chine-Culture 金文' },
  { value: CHONGXI_SEAL_FONT_STACK, family: 'InkPoem Chongxi Seal', url: '/fonts/Chongxi-Seal.otf', label: '崇羲篆体' },
];
export function getVerifiedSealFont(value: string | null | undefined): VerifiedSealFont | undefined {
  const family = value?.split(',')[0]?.trim().replace(/^["']|["']$/g, '');
  return VERIFIED_SEAL_FONTS.find((face) => face.value === value || face.family === family);
}
