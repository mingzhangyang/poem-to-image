import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getActiveStampGlyphEdits, getStampGlyphEdit, isValidStampGlyphEdit,
  isValidStampGlyphEditList, reconcileStampGlyphEdits,
  resetStampGlyphEdit, resetUnlockedStampGlyphEdits, updateStampGlyphEdit,
} from '../../src/sealGlyphEditing';
import type { StampConfig } from '../../src/types';

const sample: Pick<StampConfig,'text'|'glyphEdits'> = { text: '詩情詩印' };

test('index-scoped glyph edits never leak between repeated Chinese characters', () => {
  const atTwo = updateStampGlyphEdit(sample,2,{ offsetX:7, widthPct:115 });
  assert.deepEqual(atTwo.map(e=>e.index),[2]);
  assert.equal(atTwo[0].character,'詩');
  assert.deepEqual(getActiveStampGlyphEdits({ ...sample,glyphEdits:atTwo }),atTwo);
  assert.equal(getStampGlyphEdit({ ...sample,glyphEdits:atTwo },0).offsetX,0);
  assert.equal(getStampGlyphEdit({ ...sample,glyphEdits:atTwo },2).offsetX,7);
  const moved=updateStampGlyphEdit({ ...sample,glyphEdits:atTwo },0,{ offsetX:-6 });
  assert.deepEqual(moved.map(e=>e.index),[0,2]);
  assert.equal(atTwo.length,1,'immutable updates never mutate the previous stamp');
});

test('locking protects values until explicitly unlocked; resets ignore locks', () => {
  const moved=updateStampGlyphEdit(sample,1,{ offsetY:4, heightPct:120 });
  const frozen=updateStampGlyphEdit({ ...sample,glyphEdits:moved },1,{ locked:true });
  assert.equal(frozen[0].locked,true);
  assert.deepEqual(updateStampGlyphEdit({ ...sample,glyphEdits:frozen },1,{offsetY:12}),frozen);
  assert.deepEqual(resetStampGlyphEdit({ ...sample,glyphEdits:frozen },1),frozen);
  assert.deepEqual(resetUnlockedStampGlyphEdits({ ...sample,glyphEdits:frozen }),frozen);
  const unlocked=updateStampGlyphEdit({ ...sample,glyphEdits:frozen },1,{locked:false});
  assert.equal(unlocked[0].locked,false);
  assert.deepEqual(resetStampGlyphEdit({ ...sample,glyphEdits:unlocked },1),[]);
  const lockedDefaults=updateStampGlyphEdit(sample,0,{locked:true});
  assert.equal(lockedDefaults.length,1);
  assert.deepEqual(updateStampGlyphEdit({ ...sample,glyphEdits:lockedDefaults },0,{locked:false}),[]);
});

test('text edits keep only matching prefixes and do not transfer locks to later indices', () => {
  const edits=updateStampGlyphEdit(sample,0,{offsetX:3});
  const withSecond=updateStampGlyphEdit({...sample,glyphEdits:edits},2,{heightPct:125,locked:true});
  assert.deepEqual(reconcileStampGlyphEdits('詩情詩印','詩情詩文',withSecond),withSecond);
  assert.deepEqual(reconcileStampGlyphEdits('詩情詩印','詩人詩印',withSecond),withSecond.slice(0,1));
  assert.deepEqual(reconcileStampGlyphEdits('詩情詩印','詩情',withSecond),withSecond.slice(0,1));
  assert.deepEqual(reconcileStampGlyphEdits('詩情詩印','',withSecond),[]);
  assert.deepEqual(reconcileStampGlyphEdits('詩情詩印','字詩情詩印',withSecond),[]);
});

test('compound graphemes are addressed as user-perceived characters', () => {
  const text='𠮷詩印';
  const edits=updateStampGlyphEdit({text},0,{widthPct:105});
  assert.equal(edits[0].character,'𠮷');
  assert.equal(edits[0].index,0);
  assert.deepEqual(reconcileStampGlyphEdits(text,'𠮷詩畫',edits),edits);
  assert.deepEqual(getActiveStampGlyphEdits({text:'吉詩印',glyphEdits:edits}),[]);
});

test('bound and identity validation rejects invalid persisted glyph edits', () => {
  const edit={index:0,character:'詩',offsetX:0,offsetY:0,widthPct:100,heightPct:100,locked:false};
  assert.equal(isValidStampGlyphEdit(edit),true);
  assert.equal(isValidStampGlyphEditList([edit]),true);
  const cases=[
    {...edit,index:-1},{...edit,index:8},{...edit,index:1.2},
    {...edit,offsetX:21},{...edit,offsetY:-21},
    {...edit,widthPct:69},{...edit,heightPct:131},
    {...edit,offsetY:Infinity},{...edit,locked:'true'},
    {...edit,character:''},{...edit,character:'a'.repeat(33)},
  ];
  assert.ok(cases.every(c=>!isValidStampGlyphEdit(c)));
  assert.ok(cases.every(c=>!isValidStampGlyphEditList([c])));
  assert.equal(isValidStampGlyphEditList([edit,{...edit}]),false);
  assert.equal(isValidStampGlyphEditList(null),false);
  assert.equal(isValidStampGlyphEditList(new Array(9).fill(edit)),false);
  assert.deepEqual(updateStampGlyphEdit(sample,0,{offsetX:21}),[]);
  assert.deepEqual(updateStampGlyphEdit(sample,10,{offsetX:1}),[]);
  assert.deepEqual(getActiveStampGlyphEdits({
    text:'詩',glyphEdits:[{...edit,character:'畫'}],
  }),[]);
});

test('default edit values do not persist extra fields or modify historical stamps', () => {
  assert.deepEqual(getActiveStampGlyphEdits(sample),[]);
  assert.equal(getStampGlyphEdit(sample,0).widthPct,100);
  assert.equal(getStampGlyphEdit(sample,0).heightPct,100);
  assert.deepEqual(updateStampGlyphEdit(sample,0,{widthPct:100}),[]);
  assert.deepEqual(resetUnlockedStampGlyphEdits(sample),[]);
});
