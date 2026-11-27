#!/usr/bin/env node
// 公开图库审核脚本。通过 wrangler 直接读写 D1，不需要任何管理接口。
//
//   npm run gallery:review                 逐条审核待审作品（交互式）
//   npm run gallery:review -- pending      列出待审作品
//   npm run gallery:review -- listed       列出已在图库中的作品
//   npm run gallery:review -- reports      列出被举报的作品
//   npm run gallery:review -- show <id>    查看一件作品的状态
//   npm run gallery:review -- approve <id...>   通过，进入图库
//   npm run gallery:review -- reject <id...>    拒绝 / 撤出图库（链接保留，不能再申请）
//   npm run gallery:review -- dismiss <id...>   清除不成立的举报
//   npm run gallery:review -- remove <id...>    彻底下架：撤销分享链接并删除图片
//
// 选项：--local 使用本地 D1（wrangler dev）；--origin <url> 预览链接的域名
// （默认 https://inkpoem.com）；--limit <n> 列表条数（默认 50）；--yes 跳过
// remove 的确认。需要已登录 wrangler（npx wrangler login）。

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isShareId, sql } from './gallery-review-sql.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMMANDS = new Set(['review', 'pending', 'listed', 'reports', 'show', 'approve', 'reject', 'dismiss', 'remove', 'help']);

/** @param {string[]} argv */
export function parseArgs(argv) {
  const options = { command: 'review', ids: /** @type {string[]} */ ([]), local: false, origin: 'https://inkpoem.com', limit: 50, yes: false };
  let commandSeen = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--local') options.local = true;
    else if (arg === '--remote') options.local = false;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--help' || arg === '-h') { options.command = 'help'; commandSeen = true; }
    else if (arg === '--origin') {
      const value = argv[++i];
      const url = value ? new URL(value) : null;
      if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) throw new Error('--origin 需要 http(s) 地址');
      options.origin = url.origin;
    } else if (arg === '--limit') {
      options.limit = Number(argv[++i]);
      if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 500) throw new Error('--limit 需要 1–500 的整数');
    } else if (arg.startsWith('-')) throw new Error('未知选项：' + arg);
    else if (!commandSeen) {
      if (!COMMANDS.has(arg)) throw new Error('未知命令：' + arg);
      options.command = arg;
      commandSeen = true;
    } else {
      if (!isShareId(arg)) throw new Error('不是有效的分享 ID：' + JSON.stringify(arg));
      options.ids.push(arg);
    }
  }
  const needsIds = ['show', 'approve', 'reject', 'dismiss', 'remove'];
  if (needsIds.includes(options.command) && options.ids.length === 0) throw new Error(options.command + ' 需要至少一个分享 ID');
  if (options.command === 'show' && options.ids.length !== 1) throw new Error('show 只接受一个分享 ID');
  if (!needsIds.includes(options.command) && options.ids.length > 0) throw new Error(options.command + ' 不接受分享 ID');
  return options;
}

/**
 * Titles and authors are visitor-supplied. Strip control and bidi characters
 * so they cannot move the cursor or recolour the terminal.
 * @param {unknown} value
 */
export function clean(value) {
  if (value === null || value === undefined) return '';
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  return String(value).replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ');
}

/** @param {string} stdout */
export function parseWranglerJson(stdout) {
  const start = stdout.indexOf('[');
  if (start < 0) throw new Error('wrangler 没有返回 JSON：\n' + stdout);
  const parsed = JSON.parse(stdout.slice(start));
  if (!Array.isArray(parsed)) throw new Error('wrangler 返回了意外的结果');
  for (const result of parsed) {
    if (result && result.success === false) throw new Error('D1 执行失败：' + JSON.stringify(result));
  }
  return parsed;
}

function wranglerBin() {
  const bin = join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  if (!existsSync(bin)) throw new Error('找不到 wrangler，请先在仓库根目录运行 npm ci');
  return bin;
}

/**
 * Runs one or more statements in a single wrangler call and returns the
 * per-statement results.
 * @param {{ local: boolean }} options
 * @param {string | string[]} statements
 */
function execute(options, statements) {
  const command = (Array.isArray(statements) ? statements : [statements]).join(';\n');
  const result = spawnSync(process.execPath, [
    wranglerBin(), 'd1', 'execute', 'DB', options.local ? '--local' : '--remote',
    '--json', '--yes', '--config', 'wrangler.jsonc', '--command', command,
  ], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('wrangler 执行失败（退出码 ' + result.status + '）：\n' + (result.stderr || result.stdout));
  }
  return parseWranglerJson(result.stdout);
}

/** Rows returned by a single query. @param {{ local: boolean }} options @param {string} query */
function d1(options, query) {
  const [first] = execute(options, query);
  return Array.isArray(first?.results) ? first.results : [];
}

/**
 * Rows changed by the first statement, counted from its RETURNING rows.
 * @param {{ local: boolean }} options @param {string[]} statements
 */
function d1Changes(options, statements) {
  const [first] = execute(options, statements);
  return Array.isArray(first?.results) ? first.results.length : 0;
}

const STATUS_LABEL = { pending: '待审核', listed: '已入库', rejected: '已拒绝' };
const REASON_LABEL = { copyright: '侵权', privacy: '隐私', inappropriate: '不当内容', other: '其他' };

/** @param {unknown} reasons */
function reasonText(reasons) {
  if (!reasons) return '';
  return String(reasons).split(',').map((reason) => REASON_LABEL[/** @type {keyof typeof REASON_LABEL} */ (reason)] ?? clean(reason)).join('、');
}

/** @param {Record<string, unknown>} row @param {string} origin */
function describe(row, origin) {
  const id = String(row.id);
  const lines = [
    `  《${clean(row.title) || '无题'}》${row.author ? ' · ' + clean(row.author) : ''}`,
    `  ID        ${id}`,
  ];
  if (row.gallery_status !== undefined) lines.push(`  图库状态  ${STATUS_LABEL[/** @type {keyof typeof STATUS_LABEL} */ (row.gallery_status)] ?? '未申请'}`);
  if (row.published_at) lines.push(`  发布时间  ${clean(row.published_at)} UTC`);
  if (row.gallery_requested_at) lines.push(`  申请时间  ${clean(row.gallery_requested_at)} UTC`);
  if (row.gallery_listed_at) {
    lines.push(`  入库时间  ${clean(row.gallery_listed_at)} UTC${row.gallery_status === 'pending' ? '（因举报重新审核）' : ''}`);
  }
  if (row.revoked_at) lines.push(`  已撤销    ${clean(row.revoked_at)} UTC`);
  if (row.expiry_policy && row.expiry_policy !== 'never') lines.push(`  有效期    ${clean(row.expiry_policy)}（非永久，不能入库）`);
  if (Number(row.report_count) > 0) lines.push(`  举报      ${row.report_count} 次：${reasonText(row.report_reasons)}`);
  lines.push(`  作品页    ${origin}/s/${id}`);
  if (!row.revoked_at) lines.push(`  原图      ${origin}/s/${id}/image.${row.image_type === 'image/png' ? 'png' : 'jpg'}`);
  return lines.join('\n');
}

/** @param {Record<string, unknown>[]} rows @param {string} origin @param {string} empty */
function printRows(rows, origin, empty) {
  if (rows.length === 0) { console.log(empty); return; }
  rows.forEach((row, index) => {
    console.log(`[${index + 1}/${rows.length}]`);
    console.log(describe(row, origin));
    console.log('');
  });
}

/** @param {string} url */
function openInBrowser(url) {
  const [command, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => console.log('  无法自动打开浏览器，请手动访问：' + url));
    child.unref();
  } catch {
    console.log('  无法自动打开浏览器，请手动访问：' + url);
  }
}

/**
 * Line prompts that also work with piped input: readline's question() drops
 * lines that arrive before it is called, the async iterator buffers them.
 */
function createPrompter() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
  const lines = rl[Symbol.asyncIterator]();
  return {
    /** @param {string} question @returns {Promise<string | null>} null at end of input */
    async ask(question) {
      process.stdout.write(question);
      const { value, done } = await lines.next();
      return done ? null : String(value).trim();
    },
    close() { rl.close(); },
  };
}

/** @param {ReturnType<typeof parseArgs>} options @param {string[]} ids */
function applyRemove(options, ids) {
  const changed = d1Changes(options, sql.remove(ids));
  console.log(`已彻底下架 ${changed} 件作品。图片会在一小时内由定时任务从 R2 删除。`);
}

/** @param {ReturnType<typeof parseArgs>} options */
async function interactiveReview(options) {
  const rows = d1(options, sql.pending(options.limit));
  if (rows.length === 0) { console.log('没有待审核的作品。'); return; }
  console.log(`共有 ${rows.length} 件待审核作品。\n`);
  const prompt = createPrompter();
  const tally = { approved: 0, rejected: 0, removed: 0, skipped: 0 };
  try {
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const id = String(row.id);
      console.log(`[${index + 1}/${rows.length}]`);
      console.log(describe(row, options.origin));
      for (;;) {
        const answer = (await prompt.ask('  [a]通过  [r]拒绝  [s]跳过  [o]在浏览器打开  [d]彻底下架  [q]退出 > '))?.toLowerCase() ?? 'q';
        if (answer === 'o') { openInBrowser(`${options.origin}/s/${id}`); continue; }
        if (answer === 'a') {
          const changed = d1Changes(options, sql.approve([id]));
          console.log(changed ? '  ✓ 已通过，作品进入公开图库\n' : '  状态已变化（可能已被撤销），未修改\n');
          if (changed) tally.approved++;
        } else if (answer === 'r') {
          const changed = d1Changes(options, sql.reject([id]));
          console.log(changed ? '  ✓ 已拒绝，分享链接保留\n' : '  状态已变化，未修改\n');
          if (changed) tally.rejected++;
        } else if (answer === 'd') {
          const confirm = await prompt.ask('  将撤销分享链接并删除图片，且无法恢复。输入 yes 确认 > ');
          if (confirm !== 'yes') { console.log('  已取消'); continue; }
          applyRemove(options, [id]);
          tally.removed++;
          console.log('');
        } else if (answer === 's' || answer === '') {
          tally.skipped++;
          console.log('');
        } else if (answer === 'q') {
          return;
        } else {
          continue;
        }
        break;
      }
    }
  } finally {
    prompt.close();
    console.log(`本次：通过 ${tally.approved}，拒绝 ${tally.rejected}，下架 ${tally.removed}，跳过 ${tally.skipped}。`);
  }
}

/** @param {ReturnType<typeof parseArgs>} options */
async function run(options) {
  const target = options.local ? '本地 D1' : '线上 D1';
  switch (options.command) {
    case 'help':
      console.log(readUsage());
      return;
    case 'review':
      console.log(`正在读取${target}…`);
      await interactiveReview(options);
      return;
    case 'pending':
      printRows(d1(options, sql.pending(options.limit)), options.origin, '没有待审核的作品。');
      return;
    case 'listed':
      printRows(d1(options, sql.listed(options.limit)), options.origin, '图库里还没有作品。');
      return;
    case 'reports':
      printRows(d1(options, sql.reports(options.limit)), options.origin, '没有未处理的举报。');
      return;
    case 'show': {
      const rows = d1(options, sql.show(options.ids[0]));
      printRows(rows, options.origin, '找不到这个分享 ID。');
      return;
    }
    case 'approve':
      console.log(`已通过 ${d1Changes(options, sql.approve(options.ids))} / ${options.ids.length} 件（只处理待审核、仍有效的永久作品）。`);
      return;
    case 'reject':
      console.log(`已拒绝 ${d1Changes(options, sql.reject(options.ids))} / ${options.ids.length} 件（只处理待审核或已入库的作品）。`);
      return;
    case 'dismiss':
      console.log(`已清除 ${d1Changes(options, sql.dismissReports(options.ids))} 条举报。`);
      return;
    case 'remove': {
      if (!options.yes) {
        const prompt = createPrompter();
        const confirm = await prompt.ask(`将撤销 ${options.ids.length} 个分享链接并删除图片，且无法恢复。输入 yes 确认 > `);
        prompt.close();
        if (confirm !== 'yes') { console.log('已取消'); return; }
      }
      applyRemove(options, options.ids);
      return;
    }
  }
}

function readUsage() {
  return [
    '用法：npm run gallery:review -- [命令] [分享ID...] [选项]',
    '',
    '命令：',
    '  review              逐条审核待审作品（默认）',
    '  pending             列出待审作品',
    '  listed              列出已在图库中的作品',
    '  reports             列出被举报的作品',
    '  show <id>           查看一件作品的状态',
    '  approve <id...>     通过，进入图库',
    '  reject <id...>      拒绝或撤出图库（分享链接保留，创作者不能再申请）',
    '  dismiss <id...>     清除不成立的举报',
    '  remove <id...>      彻底下架：撤销分享链接，图片随后删除',
    '',
    '选项：',
    '  --local             使用本地 D1（wrangler dev 的数据）',
    '  --origin <url>      预览链接使用的域名，默认 https://inkpoem.com',
    '  --limit <n>         列表条数，默认 50',
    '  --yes               remove 时跳过确认',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
