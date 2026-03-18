const fs = require('fs');
const path = require('path');
const translationsPath = path.join(process.cwd(), 'src', 'translations.ts');
let content = fs.readFileSync(translationsPath, 'utf8');
content = content.replace(/(logos:\s*"[^"]+",)/g, '$1\n    size: "Size",\n    opacity: "Opacity",');
fs.writeFileSync(translationsPath, content);
console.log('Translations updated');
