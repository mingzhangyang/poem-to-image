/** Curated, editable background colors. Presets do not change poem typography. */
export const SOLID_COLOR_PRESET_GROUPS = [
  { id: 'muted', labelKey: 'bgPaletteMuted', colors: [
    { id: 'warm-clay', hex: '#F1E7E2', labelZh: '暖陶', labelEn: 'Warm clay' },
    { id: 'mist-teal', hex: '#DCE7E5', labelZh: '雾青', labelEn: 'Mist teal' },
    { id: 'smoke-blue', hex: '#D8DFE8', labelZh: '烟蓝', labelEn: 'Smoke blue' },
    { id: 'lotus-pink', hex: '#DCCEDB', labelZh: '藕粉', labelEn: 'Lotus pink' },
    { id: 'sand-apricot', hex: '#E9D9C6', labelZh: '沙杏', labelEn: 'Sand apricot' },
    { id: 'moss-green', hex: '#DDE4D1', labelZh: '苔绿', labelEn: 'Moss green' },
    { id: 'warm-stone', hex: '#E7E2DB', labelZh: '暖石', labelEn: 'Warm stone' },
    { id: 'cloud-grey', hex: '#D3DEE1', labelZh: '云灰', labelEn: 'Cloud grey' },
  ] },
  { id: 'chinese-inspired', labelKey: 'bgPaletteChinese', colors: [
    { id: 'silk-white', hex: '#F4F0E5', labelZh: '绢白', labelEn: 'Silk white' },
    { id: 'moon-white', hex: '#D6ECF0', labelZh: '月白', labelEn: 'Moon white' },
    { id: 'lotus-blush', hex: '#E8D8D5', labelZh: '藕荷', labelEn: 'Lotus blush' },
    { id: 'bamboo-green', hex: '#C5D7B6', labelZh: '竹青', labelEn: 'Bamboo green' },
    { id: 'pale-gold', hex: '#F8E0B5', labelZh: '缃黄', labelEn: 'Pale gold' },
    { id: 'wisteria', hex: '#D0D8EA', labelZh: '藤紫', labelEn: 'Wisteria' },
    { id: 'soft-rouge', hex: '#E7B9B3', labelZh: '淡胭脂', labelEn: 'Soft rouge' },
    { id: 'pine-mist', hex: '#C6D9CF', labelZh: '松烟', labelEn: 'Pine mist' },
  ] },
] as const;

export const GRADIENT_PRESETS = [
  { id: 'misty-hills', from: '#F6F4EE', to: '#C5D8D2', direction: 'to bottom right', labelZh: '雾山远岚', labelEn: 'Misty hills' },
  { id: 'lotus-dawn', from: '#F6E5DC', to: '#E8C6D2', direction: 'to bottom', labelZh: '荷色晨光', labelEn: 'Lotus dawn' },
  { id: 'bamboo-breeze', from: '#EEF0DF', to: '#BDD3C0', direction: 'to right', labelZh: '竹影清风', labelEn: 'Bamboo breeze' },
  { id: 'sea-mist', from: '#E4F0F2', to: '#BADCE5', direction: 'to bottom right', labelZh: '海雾微光', labelEn: 'Sea mist' },
  { id: 'warm-paper', from: '#FCF8EF', to: '#E5D8C4', direction: 'to bottom', labelZh: '宣纸暖光', labelEn: 'Warm paper' },
  { id: 'lilac-twilight', from: '#F1E9F3', to: '#CED1E7', direction: 'to top right', labelZh: '淡紫暮光', labelEn: 'Lilac twilight' },
] as const;
