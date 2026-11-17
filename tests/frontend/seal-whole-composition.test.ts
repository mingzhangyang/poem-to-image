import assert from 'node:assert/strict';
import test from 'node:test';
import {
  composeWholeStampLayout, getCompositionTightness, getWholeSealColumnChoices,
  isWholeSealComposition, type WholeStampGlyphMetrics, type WholeStampLayout,
} from '../../src/sealWholeComposition';
import { getStampDimensions } from '../../src/stampRendering';
import type { StampConfig, StampStyle } from '../../src/types';

const shared: StampConfig = {
  text: '詩情畫意', style: 'square', mode: 'zhuwen',
  compositionMode: 'whole', compositionTightness: 70,
  colorScheme: 'outline', size: 120, positionX: 50, positionY: 50,
  rotation: 0, opacity: 1, fontFamily: 'serif',
};

function metricAt(index: number): WholeStampGlyphMetrics {
  return {
    actualBoundingBoxLeft: 30 + (index % 3) * 2,
    actualBoundingBoxRight: 39 + (index % 2) * 3,
    actualBoundingBoxAscent: 65 + (index % 2) * 3,
    actualBoundingBoxDescent: 10 + (index % 3),
  };
}
function solve(s: StampConfig, stroke = 0): WholeStampLayout {
  return composeWholeStampLayout(s, [...s.text].map((_,i)=>metricAt(i)), stroke);
}
function validateInk(s: StampConfig, result: WholeStampLayout) {
  const size = getStampDimensions(s);
  const short = Math.min(size.width, size.height);
  const inset = result.borderWidth * 0.75 + short * 0.019;
  const radiusX = size.width / 2 - inset;
  const radiusY = size.height / 2 - inset;
  for (const glyph of result.fits) {
    assert.ok(glyph.scale > 0 && Number.isFinite(glyph.scale));
    const b = glyph.ink;
    assert.ok(b.left < b.right && b.top < b.bottom);
    assert.ok(Math.abs(b.left) <= radiusX + 1e-5);
    assert.ok(Math.abs(b.right) <= radiusX + 1e-5);
    assert.ok(Math.abs(b.top) <= radiusY + 1e-5);
    assert.ok(Math.abs(b.bottom) <= radiusY + 1e-5);
    if (s.style === 'round' || s.style === 'oval') {
      for (const x of [b.left,b.right]) for (const y of [b.top,b.bottom]) {
        assert.ok((x / radiusX)**2 + (y / radiusY)**2 <= 1 + 1e-5,
          'all four painted corners, including stroke, must fit the curved face');
      }
    }
  }
  for (let i=0;i<result.fits.length;i++) for (let j=i+1;j<result.fits.length;j++) {
    const a=result.fits[i].ink, b=result.fits[j].ink;
    assert.ok(a.right <= b.left + 1e-6 || b.right <= a.left + 1e-6
      || a.bottom <= b.top + 1e-6 || b.bottom <= a.top + 1e-6,
      'painted glyph rectangles must never collide');
  }
}

test('old saved seals never opt into a different compositor implicitly', () => {
  assert.equal(isWholeSealComposition({ mode:'zhuwen' }), false);
  assert.equal(isWholeSealComposition({ mode:'baiwen',compositionMode:'legacy' }), false);
  assert.equal(isWholeSealComposition({ mode:'modern',compositionMode:'whole' }), false);
  assert.equal(isWholeSealComposition({ mode:'zhuwen',compositionMode:'whole' }), true);
  assert.equal(isWholeSealComposition({ mode:'baiwen',compositionMode:'name' }), true);
  assert.equal(getCompositionTightness({}), 70);
  assert.equal(getCompositionTightness({ compositionTightness: Number.NaN }), 70);
  assert.equal(getCompositionTightness({ compositionTightness:-100 }), 0);
  assert.equal(getCompositionTightness({ compositionTightness:1000 }), 100);
});

test('1–8 measured glyphs fit the seal face for all six shapes at every tightness', () => {
  const shapes: StampStyle[] = [
    'square','round','brush','rect-vertical','rect-horizontal','oval',
  ];
  for (const style of shapes) for (let n=1;n<=8;n++) {
    const text='詩情畫意山水天地'.slice(0,n);
    for (const tightness of [0,40,70,100]) {
      const s = { ...shared, style, text, shapeRatio:0.6,
        compositionTightness:tightness };
      const result = solve(s, 1.2);
      assert.equal(result.fits.length,n,style+' '+n+' '+tightness);
      assert.equal(result.groups.flat().length,n);
      assert.deepEqual(result.groups.flat(),Array.from({length:n},(_,i)=>i));
      validateInk(s,result);
    }
  }
});

test('three different candidate partitions for four-character square seals', () => {
  const plans=[0,1,2].map(variant=>solve({
    ...shared,compositionVariant:variant as 0|1|2,
  }));
  assert.equal(new Set(plans.map(p=>JSON.stringify(p.groups))).size,3);
  assert.ok(plans.every(p=>p.fits.length===4));
  plans.forEach(p=>validateInk(shared,p));
  assert.deepEqual(plans.map(p=>p.variant),[0,1,2]);
  assert.equal(getWholeSealColumnChoices(shared).length,4);
  assert.equal(getWholeSealColumnChoices({...shared,text:'甲乙丙',style:'rect-vertical'}).length,2);
});

test('three-character surname is explicit right-one-left-two, never inferred', () => {
  const text='王小明';
  const name = solve({...shared,text,compositionMode:'name'});
  assert.deepEqual(name.groups,[[0],[1,2]]);
  assert.ok(name.fits[0].ink.left > name.fits[1].ink.right);
  assert.ok(name.fits[1].ink.bottom <= name.fits[2].ink.top);
  const automatic = solve({...shared,text,compositionMode:'whole'});
  assert.equal(automatic.fits.length,3);
  validateInk({...shared,text},automatic);
  validateInk({...shared,text},name);
});

test('compactness slider preserves partition while changing painted area', () => {
  const s={...shared,text:'山水天地詩情'};
  const airy=solve({...s,compositionTightness:0,compositionVariant:1});
  const dense=solve({...s,compositionTightness:100,compositionVariant:1});
  assert.deepEqual(airy.groups,dense.groups);
  assert.ok(dense.paintedArea > airy.paintedArea);
  assert.ok(dense.gap < airy.gap);
  validateInk(s,airy);
  validateInk(s,dense);
});

test('solver is deterministic across repaint and handles malformed metrics', () => {
  const first=solve(shared), second=solve({...shared});
  assert.deepEqual(first,second);
  assert.equal(composeWholeStampLayout(shared,[]).fits.length,0);
  const bad=composeWholeStampLayout({...shared,text:'印'},[
    { actualBoundingBoxLeft:0,actualBoundingBoxRight:0,
      actualBoundingBoxAscent:0,actualBoundingBoxDescent:0 },
  ]);
  assert.ok(bad.fits.every(f=>Number.isFinite(f.scale)));
  assert.ok(solve({...shared,size:0}).fits.every(f=>Number.isFinite(f.scale)));
});


test('explicit per-glyph width/height and offsets affect only the selected glyph', () => {
  const s={...shared,text:'印',compositionTightness:0};
  const old=solve(s);
  const edited=solve({
    ...s,glyphEdits:[{index:0,character:'印',offsetX:3,offsetY:-4,
      widthPct:115,heightPct:85,locked:true}],
  });
  assert.equal(old.fits.length,1);
  assert.equal(edited.fits.length,1);
  assert.equal(edited.fits[0].scale,old.fits[0].scale);
  assert.ok((edited.fits[0].scaleX??0)>(edited.fits[0].scaleY??Infinity));
  assert.notEqual((old.fits[0].ink.left+old.fits[0].ink.right)/2,
    (edited.fits[0].ink.left+edited.fits[0].ink.right)/2);
  assert.notEqual((old.fits[0].ink.top+old.fits[0].ink.bottom)/2,
    (edited.fits[0].ink.top+edited.fits[0].ink.bottom)/2);
  validateInk(s,edited);
});

test('edited whole seals retain no-overlap and painted bounds in all six shapes', () => {
  const shapes:StampStyle[]=['square','round','brush','rect-vertical','rect-horizontal','oval'];
  for(const style of shapes) for(const mode of ['zhuwen','baiwen'] as const){
    const s={...shared,style,mode,text:'詩情畫意山水天地',shapeRatio:0.6,
      glyphEdits:[
        {index:0,character:'詩',offsetX:-20,offsetY:-20,widthPct:130,heightPct:125,locked:true},
        {index:1,character:'情',offsetX:20,offsetY:20,widthPct:130,heightPct:130,locked:false},
        {index:2,character:'畫',offsetX:6,offsetY:0,widthPct:70,heightPct:110,locked:false},
      ],
    };
    const result=solve(s,3.5);
    assert.equal(result.fits.length,8,style+' '+mode);
    validateInk(s,result);
  }
});

test('unmodified historic compositions produce identical fits even with empty edit list', () => {
  const old=solve(shared);
  const empty=solve({...shared,glyphEdits:[]});
  assert.deepEqual(empty,old);
  const edited=solve({...shared,glyphEdits:[
    {index:1,character:'情',offsetX:5,offsetY:0,widthPct:100,heightPct:100,locked:false},
  ]});
  assert.deepEqual(edited.groups,old.groups);
  assert.equal(edited.fits[0].x,old.fits[0].x);
  assert.equal(edited.fits[2].y,old.fits[2].y);
});

test('locked edits do not change deterministic plans or candidate ranks', () => {
  const e={index:0,character:'詩',offsetX:12,offsetY:-10,widthPct:120,
    heightPct:90,locked:true};
  for(const variant of [0,1,2] as const){
    const s={...shared,compositionVariant:variant,glyphEdits:[e]};
    const a=solve(s,2);
    const b=solve({...s},2);
    assert.deepEqual(a,b);
    assert.deepEqual(a.groups,solve({...s,glyphEdits:[]},2).groups);
    validateInk(s,a);
  }
});


test('locking an untouched glyph never changes its pixels or optical layout', () => {
  const baseline=solve(shared,1.5);
  const locked=solve({...shared,glyphEdits:[
    {index:0,character:'詩',offsetX:0,offsetY:0,
      widthPct:100,heightPct:100,locked:true},
  ]},1.5);
  assert.deepEqual(locked,baseline);
});
