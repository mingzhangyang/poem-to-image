import fs from 'fs';
import path from 'path';

const templatesPath = path.resolve('src/templates.ts');
let content = fs.readFileSync(templatesPath, 'utf8');

function replace(regex, replacement) {
  content = content.replace(regex, replacement);
}

// 1. modern-minimal
// typography overrides padding
content = content.replace(
  /'modern-minimal': \{\s+(?:[a-zA-Z-]+:\s+\{[\s\S]*?padding:\s*)(\d+)(,\s+\},?\s+)+\},/g,
  (match) => match.replace(/padding:\s*\d+/g, 'padding: 96')
);
content = content.replace(
  /'modern-minimal': \{\s*(?:[a-zA-Z-]+:\s+\{[\s\S]*?lineHeight:\s*)(1\.\d+)(,\s+[\s\S]*?\},?\s+)+\},/g,
  (match) => match.replace(/lineHeight:\s*1\.[5-7]\d?/g, 'lineHeight: 1.75')
);

// Base modern-minimal
replace(
  /id: 'modern-minimal',[\s\S]*?backgroundType: 'solid',[\s\S]*?gradientColor2: '#e2e8f0',/m,
  (match) => match.replace("backgroundType: 'solid'", "backgroundType: 'gradient'")
                  .replace("gradientColor2: '#e2e8f0'", "gradientColor2: '#f1f5f9'")
);
replace(
  /id: 'modern-minimal',[\s\S]*?borderStyle: 'shadow',\s*borderColor: '#0f172a',\s*borderWidth: 3,/m,
  (match) => match.replace('borderWidth: 3', 'borderWidth: 2')
);


// 2. ink-wash
replace(
  /id: 'ink-wash',[\s\S]*?bgBrightness: 100,/m,
  (match) => match.replace('bgBrightness: 100', 'bgBrightness: 98')
);
// titleScale in overrides
replace(
  /'ink-wash': \{\s*'zh-CN': \{\s*titleScale: 1\.32,/m,
  (match) => match.replace('titleScale: 1.32', 'titleScale: 1.35')
);
replace(
  /'zh-TW': \{\s*titleScale: 1\.32,/m,
  (match) => match.replace('titleScale: 1.32', 'titleScale: 1.35')
);
replace(
  /ja: \{\s*titleScale: 1\.28,/m,
  (match) => match.replace('titleScale: 1.28', 'titleScale: 1.31')
);

// 3. parchment-scroll
replace(
  /id: 'parchment-scroll',[\s\S]*?bgBlur: 0,/m,
  (match) => match.replace('bgBlur: 0', 'bgBlur: 0.5')
);
replace(
  /id: 'parchment-scroll',[\s\S]*?padding: 100,/m,
  (match) => match.replace('padding: 100', 'padding: 112')
);
replace(
  /id: 'parchment-scroll',[\s\S]*?borderWidth: 6,/m,
  (match) => match.replace('borderWidth: 6', 'borderWidth: 8')
);
content = content.replace(
  /'parchment-scroll':\s*\{\s*(?:'[a-zA-Z-]+'|[a-zA-Z-]+):\s*\{[\s\S]*?padding:\s*\d+,[\s\S]*?\}(?:,\s*(?:'[a-zA-Z-]+'|[a-zA-Z-]+):\s*\{[\s\S]*?padding:\s*\d+,[\s\S]*?\})*\s*\}/m,
  (match) => match.replace(/padding:\s*\d+/g, 'padding: 112')
);

// 4. cyberpunk
replace(
  /id: 'cyberpunk',[\s\S]*?gradientColor1: '#020617',[\s\S]*?gradientColor2: '#7e22ce',/m,
  (match) => match.replace("gradientColor1: '#020617'", "gradientColor1: '#09090b'")
                  .replace("gradientColor2: '#7e22ce'", "gradientColor2: '#5b21b6'")
);
replace(
  /id: 'cyberpunk',[\s\S]*?textShadowBlur: 14,/m,
  (match) => match.replace('textShadowBlur: 14', 'textShadowBlur: 18')
);
replace(
  /id: 'cyberpunk',[\s\S]*?borderWidth: 4,/m,
  (match) => match.replace('borderWidth: 4', 'borderWidth: 3')
);

// 5. japanese-magazine
replace(
  /id: 'japanese-magazine',[\s\S]*?gradientColor2: '#f5efe6',/m,
  (match) => match.replace("gradientColor2: '#f5efe6'", "gradientColor2: '#f1eadd'")
);
replace(
  /id: 'japanese-magazine',[\s\S]*?fontSize: 30,/m,
  (match) => match.replace('fontSize: 30', 'fontSize: 32')
);
replace(
  /id: 'japanese-magazine',[\s\S]*?borderWidth: 6,/m,
  (match) => match.replace('borderWidth: 6', 'borderWidth: 8')
);

// 6. mountain-mist-photo
replace(
  /id: 'mountain-mist-photo',[\s\S]*?bgBlur: 0\.2,/m,
  (match) => match.replace('bgBlur: 0.2', 'bgBlur: 0.4')
);
replace(
  /id: 'mountain-mist-photo',[\s\S]*?textShadowBlur: 6,/m,
  (match) => match.replace('textShadowBlur: 6', 'textShadowBlur: 10')
);
replace(
  /id: 'mountain-mist-photo',[\s\S]*?borderColor: '#1f2937',/m,
  (match) => match.replace("borderColor: '#1f2937'", "borderColor: '#172117'")
);

// 7. colorblock-cyan-magenta
replace(
  /id: 'colorblock-cyan-magenta',[\s\S]*?textShadowBlur: 12,/m,
  (match) => match.replace('textShadowBlur: 12', 'textShadowBlur: 16')
);
replace(
  /id: 'colorblock-cyan-magenta',[\s\S]*?borderColor: '#0f172a',\s*borderWidth: 4,/m,
  (match) => match.replace("borderColor: '#0f172a'", "borderColor: '#ffffff'")
                  .replace('borderWidth: 4', 'borderWidth: 6')
);

fs.writeFileSync(templatesPath, content, 'utf8');
console.log('Templates successfully updated.');
