/** Curated, editable background colors. Presets do not change poem typography. */
export const SOLID_COLOR_PRESET_GROUPS = [
  { id: 'muted', labelKey: 'bgPaletteMuted', colors: [
    { id: 'warm-clay', hex: '#F1E7E2', labelKey: 'bgPresetWarmClay' },
    { id: 'mist-teal', hex: '#DCE7E5', labelKey: 'bgPresetMistTeal' },
    { id: 'smoke-blue', hex: '#D8DFE8', labelKey: 'bgPresetSmokeBlue' },
    { id: 'lotus-pink', hex: '#DCCEDB', labelKey: 'bgPresetLotusPink' },
    { id: 'sand-apricot', hex: '#E9D9C6', labelKey: 'bgPresetSandApricot' },
    { id: 'moss-green', hex: '#DDE4D1', labelKey: 'bgPresetMossGreen' },
    { id: 'warm-stone', hex: '#E7E2DB', labelKey: 'bgPresetWarmStone' },
    { id: 'cloud-grey', hex: '#D3DEE1', labelKey: 'bgPresetCloudGrey' },
  ] },
  { id: 'chinese-inspired', labelKey: 'bgPaletteChinese', colors: [
    { id: 'silk-white', hex: '#F4F0E5', labelKey: 'bgPresetSilkWhite' },
    { id: 'moon-white', hex: '#D6ECF0', labelKey: 'bgPresetMoonWhite' },
    { id: 'lotus-blush', hex: '#E8D8D5', labelKey: 'bgPresetLotusBlush' },
    { id: 'bamboo-green', hex: '#C5D7B6', labelKey: 'bgPresetBambooGreen' },
    { id: 'pale-gold', hex: '#F8E0B5', labelKey: 'bgPresetPaleGold' },
    { id: 'wisteria', hex: '#D0D8EA', labelKey: 'bgPresetWisteria' },
    { id: 'soft-rouge', hex: '#E7B9B3', labelKey: 'bgPresetSoftRouge' },
    { id: 'pine-mist', hex: '#C6D9CF', labelKey: 'bgPresetPineMist' },
  ] },
] as const;

export const GRADIENT_PRESETS = [
  { id: 'misty-hills', from: '#F6F4EE', to: '#C5D8D2', direction: 'to bottom right', labelKey: 'bgPresetMistyHills' },
  { id: 'lotus-dawn', from: '#F6E5DC', to: '#E8C6D2', direction: 'to bottom', labelKey: 'bgPresetLotusDawn' },
  { id: 'bamboo-breeze', from: '#EEF0DF', to: '#BDD3C0', direction: 'to right', labelKey: 'bgPresetBambooBreeze' },
  { id: 'sea-mist', from: '#E4F0F2', to: '#BADCE5', direction: 'to bottom right', labelKey: 'bgPresetSeaMist' },
  { id: 'warm-paper', from: '#FCF8EF', to: '#E5D8C4', direction: 'to bottom', labelKey: 'bgPresetWarmPaper' },
  { id: 'lilac-twilight', from: '#F1E9F3', to: '#CED1E7', direction: 'to top right', labelKey: 'bgPresetLilacTwilight' },
] as const;
