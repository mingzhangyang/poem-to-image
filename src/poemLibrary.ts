import type { Language } from './translations';
import type { PoemAutofillSuggestion, PoemContentData } from './types';

export interface PoemLibraryEntry {
  id: string;
  language: Language;
  title: string;
  author: string;
  body: string;
  sourceNote: string;
  source: string;
  licenseStatus: 'public-domain';
  licenseNote: string;
}

export interface PoemMatcherRequestMessage {
  type: 'find_match';
  requestId: number;
  language: Language;
  query: string;
}

export interface PoemMatcherResponseMessage {
  type: 'match_result';
  requestId: number;
  suggestion: PoemAutofillSuggestion | null;
}

interface IndexedPoemLibraryEntry extends PoemLibraryEntry {
  normalizedBody: string;
  normalizedTitle: string;
  normalizedAuthor: string;
  normalizedLines: string[];
}

export const POEM_LIBRARY_ENTRIES: PoemLibraryEntry[] = [
  {
    id: 'zhcn-jing-ye-si',
    language: 'zh-CN',
    title: '静夜思',
    author: '李白',
    body: '床前明月光\n疑是地上霜\n举头望明月\n低头思故乡',
    sourceNote: '唐',
    source: '《全唐诗》',
    licenseStatus: 'public-domain',
    licenseNote: 'Tang dynasty text, public domain.',
  },
  {
    id: 'zhtw-jing-ye-si',
    language: 'zh-TW',
    title: '靜夜思',
    author: '李白',
    body: '床前明月光\n疑是地上霜\n舉頭望明月\n低頭思故鄉',
    sourceNote: '唐',
    source: '《全唐詩》',
    licenseStatus: 'public-domain',
    licenseNote: 'Tang dynasty text, public domain.',
  },
  {
    id: 'zhcn-chun-xiao',
    language: 'zh-CN',
    title: '春晓',
    author: '孟浩然',
    body: '春眠不觉晓\n处处闻啼鸟\n夜来风雨声\n花落知多少',
    sourceNote: '唐',
    source: '《全唐诗》',
    licenseStatus: 'public-domain',
    licenseNote: 'Tang dynasty text, public domain.',
  },
  {
    id: 'zhtw-chun-xiao',
    language: 'zh-TW',
    title: '春曉',
    author: '孟浩然',
    body: '春眠不覺曉\n處處聞啼鳥\n夜來風雨聲\n花落知多少',
    sourceNote: '唐',
    source: '《全唐詩》',
    licenseStatus: 'public-domain',
    licenseNote: 'Tang dynasty text, public domain.',
  },
  {
    id: 'zhcn-deng-guan-que-lou',
    language: 'zh-CN',
    title: '登鹳雀楼',
    author: '王之涣',
    body: '白日依山尽\n黄河入海流\n欲穷千里目\n更上一层楼',
    sourceNote: '唐',
    source: '《全唐诗》',
    licenseStatus: 'public-domain',
    licenseNote: 'Tang dynasty text, public domain.',
  },
  {
    id: 'zhtw-deng-guan-que-lou',
    language: 'zh-TW',
    title: '登鸛雀樓',
    author: '王之渙',
    body: '白日依山盡\n黃河入海流\n欲窮千里目\n更上一層樓',
    sourceNote: '唐',
    source: '《全唐詩》',
    licenseStatus: 'public-domain',
    licenseNote: 'Tang dynasty text, public domain.',
  },
  {
    id: 'zhcn-wang-lu-shan-pu-bu',
    language: 'zh-CN',
    title: '望庐山瀑布',
    author: '李白',
    body: '日照香炉生紫烟\n遥看瀑布挂前川\n飞流直下三千尺\n疑是银河落九天',
    sourceNote: '唐',
    source: '《全唐诗》',
    licenseStatus: 'public-domain',
    licenseNote: 'Tang dynasty text, public domain.',
  },
  {
    id: 'zhtw-wang-lu-shan-pu-bu',
    language: 'zh-TW',
    title: '望廬山瀑布',
    author: '李白',
    body: '日照香爐生紫煙\n遙看瀑布掛前川\n飛流直下三千尺\n疑是銀河落九天',
    sourceNote: '唐',
    source: '《全唐詩》',
    licenseStatus: 'public-domain',
    licenseNote: 'Tang dynasty text, public domain.',
  },
  {
    id: 'ja-furuike-ya',
    language: 'ja',
    title: '古池や',
    author: '松尾芭蕉',
    body: '古池や\n蛙飛びこむ\n水の音',
    sourceNote: '江戸時代',
    source: '松尾芭蕉句集',
    licenseStatus: 'public-domain',
    licenseNote: 'Edo period text, public domain.',
  },
  {
    id: 'ko-cheongsanri',
    language: 'ko',
    title: '청산리 벽계수야',
    author: '황진이',
    body: '청산리 벽계수야\n수이 감을 자랑 마라\n일도창해하면\n다시 오기 어려우니\n명월이 만공산하니\n수여간들 어떠리',
    sourceNote: '조선시대',
    source: '황진이 시조',
    licenseStatus: 'public-domain',
    licenseNote: 'Joseon period text, public domain.',
  },
  {
    id: 'en-sonnet-18',
    language: 'en',
    title: 'Sonnet 18',
    author: 'William Shakespeare',
    body: 'Shall I compare thee to a summer\'s day?\nThou art more lovely and more temperate.',
    sourceNote: 'Shakespeare, 1609',
    source: 'Shakespeare\'s Sonnets',
    licenseStatus: 'public-domain',
    licenseNote: 'Published in 1609, public domain.',
  },
];

const PUNCTUATION_OR_SPACE_REGEX = /[\s\p{P}\p{S}]+/gu;

function normalizeForMatching(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(PUNCTUATION_OR_SPACE_REGEX, '');
}

function buildIndexedEntry(entry: PoemLibraryEntry): IndexedPoemLibraryEntry {
  const lines = entry.body
    .split('\n')
    .map((line) => normalizeForMatching(line))
    .filter((line) => line.length > 0);

  return {
    ...entry,
    normalizedBody: normalizeForMatching(entry.body),
    normalizedTitle: normalizeForMatching(entry.title),
    normalizedAuthor: normalizeForMatching(entry.author),
    normalizedLines: lines,
  };
}

const INDEXED_POEM_LIBRARY = POEM_LIBRARY_ENTRIES.map(buildIndexedEntry);

function scoreEntry(query: string, entry: IndexedPoemLibraryEntry): number {
  let bestScore = 0;

  if (entry.normalizedBody.includes(query)) {
    const coverage = query.length / Math.max(entry.normalizedBody.length, 1);
    bestScore = Math.max(bestScore, 0.68 + Math.min(0.27, coverage));
  }

  for (const normalizedLine of entry.normalizedLines) {
    if (normalizedLine.length < 1) {
      continue;
    }

    if (normalizedLine.includes(query)) {
      const lineCoverage = query.length / Math.max(normalizedLine.length, 1);
      bestScore = Math.max(bestScore, 0.66 + Math.min(0.3, lineCoverage));
      continue;
    }

    if (query.includes(normalizedLine)) {
      const queryCoverage = normalizedLine.length / Math.max(query.length, 1);
      bestScore = Math.max(bestScore, 0.7 + Math.min(0.25, queryCoverage));
    }
  }

  if (entry.normalizedTitle.includes(query)) {
    bestScore = Math.max(bestScore, 0.72);
  }

  if (entry.normalizedAuthor.includes(query)) {
    bestScore = Math.max(bestScore, 0.71);
  }

  return bestScore;
}

function getCandidateEntries(language: Language): IndexedPoemLibraryEntry[] {
  const exactMatch = INDEXED_POEM_LIBRARY.filter((entry) => entry.language === language);

  if (exactMatch.length > 0) {
    return exactMatch;
  }

  if (language === 'zh-CN' || language === 'zh-TW') {
    return INDEXED_POEM_LIBRARY.filter((entry) => entry.language === 'zh-CN' || entry.language === 'zh-TW');
  }

  return INDEXED_POEM_LIBRARY;
}

function toSuggestion(entry: IndexedPoemLibraryEntry, confidence: number): PoemAutofillSuggestion {
  return {
    id: entry.id,
    title: entry.title,
    author: entry.author,
    body: entry.body,
    sourceNote: entry.sourceNote,
    source: entry.source,
    licenseStatus: entry.licenseStatus,
    licenseNote: entry.licenseNote,
    confidence: Number(confidence.toFixed(2)),
  };
}

export function findBestPoemMatch(query: string, language: Language): PoemAutofillSuggestion | null {
  const normalizedQuery = normalizeForMatching(query);

  if (normalizedQuery.length < 4) {
    return null;
  }

  let bestEntry: IndexedPoemLibraryEntry | null = null;
  let bestScore = 0;

  for (const candidate of getCandidateEntries(language)) {
    const score = scoreEntry(normalizedQuery, candidate);

    if (score > bestScore) {
      bestScore = score;
      bestEntry = candidate;
    }
  }

  if (!bestEntry || bestScore < 0.7) {
    return null;
  }

  return toSuggestion(bestEntry, bestScore);
}

export function isSamePoemSuggestion(poemBody: string, suggestion: PoemAutofillSuggestion): boolean {
  return normalizeForMatching(poemBody) === normalizeForMatching(suggestion.body);
}

function normalizeSuggestionField(value: string): string {
  return value.normalize('NFKC').trim();
}

export function isAppliedPoemSuggestion(poem: PoemContentData, suggestion: PoemAutofillSuggestion): boolean {
  return isSamePoemSuggestion(poem.body, suggestion)
    && normalizeSuggestionField(poem.title) === normalizeSuggestionField(suggestion.title)
    && normalizeSuggestionField(poem.author) === normalizeSuggestionField(suggestion.author)
    && normalizeSuggestionField(poem.sourceNote) === normalizeSuggestionField(suggestion.sourceNote);
}
