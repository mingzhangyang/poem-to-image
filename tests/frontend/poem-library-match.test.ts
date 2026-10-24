import assert from 'node:assert/strict';
import test from 'node:test';
import { findBestPoemMatch, isAppliedPoemSuggestion } from '../../src/poemLibrary';

test('findBestPoemMatch identifies a known Chinese poem by partial line', () => {
  const suggestion = findBestPoemMatch('床前明月光', 'zh-CN');

  assert.ok(suggestion);
  assert.equal(suggestion?.title, '静夜思');
  assert.equal(suggestion?.author, '李白');
});

test('findBestPoemMatch tolerates punctuation and whitespace', () => {
  const suggestion = findBestPoemMatch('白日依山尽， 黄河入海流。', 'zh-CN');

  assert.ok(suggestion);
  assert.equal(suggestion?.title, '登鹳雀楼');
});

test('findBestPoemMatch prefers locale-specific variant when available', () => {
  const suggestion = findBestPoemMatch('舉頭望明月', 'zh-TW');

  assert.ok(suggestion);
  assert.equal(suggestion?.title, '靜夜思');
});

test('findBestPoemMatch returns null for very short inputs', () => {
  const suggestion = findBestPoemMatch('月光', 'zh-CN');

  assert.equal(suggestion, null);
});

test('isAppliedPoemSuggestion remains false when only body text matches', () => {
  const suggestion = findBestPoemMatch('床前明月光', 'zh-CN');
  assert.ok(suggestion);

  const applied = isAppliedPoemSuggestion({
    title: '',
    author: '',
    body: suggestion.body,
    sourceNote: '',
  }, suggestion);

  assert.equal(applied, false);
});

test('isAppliedPoemSuggestion becomes true when metadata also matches', () => {
  const suggestion = findBestPoemMatch('床前明月光', 'zh-CN');
  assert.ok(suggestion);

  const applied = isAppliedPoemSuggestion({
    title: ` ${suggestion.title} `,
    author: suggestion.author,
    body: suggestion.body,
    sourceNote: suggestion.sourceNote,
  }, suggestion);

  assert.equal(applied, true);
});

test('recognizes Shakespeare in both English and Chinese UI', () => {
  const query = "Shall I compare thee to a summer's day?\nThou art more lovely and more temperate.";
  const english = findBestPoemMatch(query, 'en');
  const chinese = findBestPoemMatch(query, 'zh-CN');

  assert.equal(english?.id, 'en-sonnet-18');
  assert.equal(chinese?.id, english?.id);
  assert.equal(chinese?.confidence, english?.confidence);
});

test('recognizes Chinese poems in an English interface', () => {
  const suggestion = findBestPoemMatch('床前明月光', 'en');
  assert.equal(suggestion?.id, 'zhcn-jing-ye-si');
});
