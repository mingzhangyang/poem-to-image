import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('route metadata is not rendered as JSX head tags', () => {
  const files = [
    'src/App.tsx',
    'src/pages/AboutPage.tsx',
    'src/pages/PrivacyPage.tsx',
    'src/pages/AccountPage.tsx',
  ];

  for (const file of files) {
    const content = readRepoFile(file);
    assert.equal(content.includes('<title>'), false, `${file} should not render <title> in component JSX`);
    assert.equal(content.includes('<meta '), false, `${file} should not render <meta> in component JSX`);
    assert.equal(content.includes('<link rel="canonical"'), false, `${file} should not render canonical link in component JSX`);
  }
});

test('major dialogs expose semantic dialog attributes', () => {
  const files = [
    'src/components/OnboardingModal.tsx',
    'src/components/PoemEditorModal.tsx',
    'src/components/sidebar/TemplatesPanel.tsx',
  ];

  for (const file of files) {
    const content = readRepoFile(file);
    assert.match(content, /role="dialog"/, `${file} should include role="dialog"`);
    assert.match(content, /aria-modal="true"/, `${file} should include aria-modal="true"`);
    assert.match(content, /aria-labelledby=/, `${file} should include aria-labelledby`);
  }
});

test('critical files do not include hardcoded CJK labels', () => {
  const files = [
    'src/canvasPresets.ts',
    'src/components/sidebar/CanvasSizePanel.tsx',
    'src/components/sidebar/SidebarFooter.tsx',
    'src/components/sidebar/DecorationsPanel.tsx',
    'src/App.tsx',
  ];
  const hanRegex = /\p{Script=Han}/u;

  for (const file of files) {
    const content = readRepoFile(file);
    assert.equal(hanRegex.test(content), false, `${file} should not contain hardcoded Han characters`);
  }
});

test('editor purchase flow surfaces checkout errors via toast', () => {
  const content = readRepoFile('src/App.tsx');
  assert.match(content, /showToast\(data\.error \?\? t\('checkoutFailed'\), 'error'\)/);
  assert.match(content, /showToast\(t\('networkError'\), 'error'\)/);
});
