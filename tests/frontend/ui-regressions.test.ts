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
    'src/components/sidebar/AddElementActions.tsx',
    'src/components/sidebar/BorderControls.tsx',
    'src/components/sidebar/CustomTextList.tsx',
    'src/components/sidebar/LogoList.tsx',
    'src/components/sidebar/SealControls.tsx',
    'src/components/sidebar/SealCompositionControls.tsx',
    'src/components/sidebar/SealFontControls.tsx',
    'src/components/sidebar/SealInkControls.tsx',
    'src/components/sidebar/SignatureList.tsx',
    'src/components/sidebar/OrnamentLibrary.tsx',
    'src/components/Sidebar.tsx',
    'src/components/sidebar/SidebarRail.tsx',
    'src/components/sidebar/SidebarHeader.tsx',
    'src/components/sidebar/panelGroups.ts',
    'src/hooks/useSidebarNavigation.ts',
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
  // Sidebar.tsx defines each panel once; the desktop rail and the mobile
  // drawer both show the groups declared in panelGroups.ts.
  const sidebar = readRepoFile('src/components/Sidebar.tsx');
  const instances = [...sidebar.matchAll(/<BackgroundPanel\b([\s\S]*?)\/>/g)];
  assert.equal(instances.length, 1, 'the paper selector should be defined once for desktop and mobile');
  assert.match(instances[0][1], /\blanguage=\{language\}/, 'paper swatch labels need the current language');

  const groups = readRepoFile('src/components/sidebar/panelGroups.ts');
  assert.match(groups, /\n\s*background:\s*\{[^}]*icon:/, 'the paper selector must have its own panel group');
  const groupOrder = groups.match(/const PANEL_GROUP_ORDER\b[^=]*=\s*\[([^\]]*)\]/);
  assert.ok(groupOrder, 'panel order should be declared');
  assert.match(groupOrder[1], /'background'/, 'the paper selector must be reachable from the rail and the mobile menus');
  // Both layouts render panels from the shared definition.
  assert.match(sidebar, /<SidebarRail\b/, 'desktop sidebar must render the navigation rail');
  assert.match(sidebar, /renderGroup\(desktopView\)/, 'desktop panel area must show the active panel');
  assert.match(sidebar, /\[\.\.\.PANEL_GROUP_ORDER, 'export', 'settings'\]/, 'mobile dock and More menu must list every panel');
});

test('mobile dock pins four destinations and lists the rest under More', () => {
  const sidebar = readRepoFile('src/components/Sidebar.tsx');
  const dock = sidebar.match(/const MOBILE_DOCK\b[^=]*=\s*\[([^\]]*)\]/);
  assert.ok(dock, 'mobile dock should be declared as data');
  assert.equal(dock[1].split(',').filter((item) => item.trim()).length, 4, 'the dock pins four destinations next to More');
  assert.match(sidebar, /MOBILE_DESTINATIONS\.filter\(\(destination\) => !MOBILE_DOCK\.includes\(destination\)\)/);
  assert.match(sidebar, /t\('quickMore'\)/);
});

test('desktop navigation rail is an accessible vertical tab list', () => {
  const rail = readRepoFile('src/components/sidebar/SidebarRail.tsx');
  const sidebar = readRepoFile('src/components/Sidebar.tsx');
  assert.match(rail, /role="tablist"/);
  assert.match(rail, /aria-orientation="vertical"/);
  assert.match(rail, /aria-label=\{t\('controlsNavigation'\)\}/);
  assert.match(rail, /role="tab"/);
  assert.match(rail, /aria-selected=/);
  assert.match(rail, /aria-controls=/);
  assert.match(rail, /tabIndex=\{selected \? 0 : -1\}/);
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) assert.match(rail, new RegExp(key));
  assert.match(sidebar, /role="tabpanel"/);
  assert.match(sidebar, /aria-labelledby=\{getRailLabelId\(desktopView\)\}/);
});

test('the selected LXGW WenKai family is defined by its local CSS', () => {
  const loader = readRepoFile('src/fontLoader.ts');
  const options = readRepoFile('src/fontOptions.ts');
  const fontCss = readRepoFile('node_modules/lxgw-wenkai-screen-webfont/lxgwwenkaiscreen.css');
  assert.match(options, /"LXGW WenKai Screen"/);
  assert.match(loader, /'LXGW WenKai Screen': \(\) => import\('lxgw-wenkai-screen-webfont\/lxgwwenkaiscreen\.css'\)/);
  assert.match(fontCss, /font-family:\s*["']?LXGW WenKai Screen["']?\s*;/i);
});

test('desktop rail carries the app mark and the panel column drops the brand header', () => {
  const sidebar = readRepoFile('src/components/Sidebar.tsx');
  const rail = readRepoFile('src/components/sidebar/SidebarRail.tsx');
  assert.match(sidebar, /<RailBrand t=\{t\} \/>\s*<SidebarRail\b/, 'the app mark sits above the rail tabs');
  const desktop = sidebar.slice(sidebar.indexOf('{/* Desktop sidebar'));
  assert.equal(desktop.includes('<SidebarHeader'), false, 'the desktop panel column must not repeat the brand header');
  // The mark is the page heading, outside role="tablist" so arrow keys skip it.
  const brand = rail.slice(rail.indexOf('export function RailBrand'));
  assert.match(brand, /<h1\b/);
  assert.match(brand, /className="sr-only">\{t\('appTitle'\)\}/);
  assert.equal(brand.includes('role="tab"'), false);
});
