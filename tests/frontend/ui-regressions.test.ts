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
    'src/components/CanvasPreview.tsx',
    'src/components/Sidebar.tsx',
  ];

  for (const file of files) {
    const content = readRepoFile(file);
    assert.match(content, /role="dialog"/, `${file} should include role="dialog"`);
    assert.match(content, /aria-modal="true"/, `${file} should include aria-modal="true"`);
    assert.match(content, /aria-labelledby=/, `${file} should include aria-labelledby`);
  }
});

test('tablet layout keeps permanent sidebar behind the large breakpoint', () => {
  const sidebar = readRepoFile('src/components/Sidebar.tsx');
  const app = readRepoFile('src/App.tsx');

  assert.match(sidebar, /min-width: 1024px/);
  assert.match(sidebar, /hidden lg:flex/);
  assert.match(app, /lg:flex-row/);
});

test('onboarding does not reuse the generic More label as its heading', () => {
  const content = readRepoFile('src/components/OnboardingModal.tsx');
  assert.equal(content.includes("t('quickMore')"), false);
  assert.match(content, /t\('onboardingWorkflowTitle'\)/);
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
  // Billing logic lives in useBillingState after the App.tsx refactor.
  const content = readRepoFile('src/hooks/useBillingState.ts');
  assert.match(content, /showToast\(data\.error \?\? t\('checkoutFailed'\), 'error'\)/);
  assert.match(content, /showToast\(t\('networkError'\), 'error'\)/);
});

test('desktop and mobile paper selectors both receive the editor language', () => {
  const sidebar = readRepoFile('src/components/Sidebar.tsx');
  const instances = [...sidebar.matchAll(/<BackgroundPanel\b([\s\S]*?)\/>/g)];
  assert.equal(instances.length, 2, 'both desktop and mobile controls must be checked');
  for (const [, attributes] of instances) {
    assert.match(attributes, /\blanguage=\{language\}/, 'paper swatch labels need the current language');
  }
});

test('the selected LXGW WenKai family is defined by its local CSS', () => {
  const loader = readRepoFile('src/fontLoader.ts');
  const options = readRepoFile('src/fontOptions.ts');
  const fontCss = readRepoFile('node_modules/lxgw-wenkai-screen-webfont/lxgwwenkaiscreen.css');
  assert.match(options, /"LXGW WenKai Screen"/);
  assert.match(loader, /'LXGW WenKai Screen': \(\) => import\('lxgw-wenkai-screen-webfont\/lxgwwenkaiscreen\.css'\)/);
  assert.match(fontCss, /font-family:\s*["']?LXGW WenKai Screen["']?\s*;/i);
});
