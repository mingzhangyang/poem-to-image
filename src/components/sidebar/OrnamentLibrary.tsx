import { OrnamentSelection } from '../../ornaments/selection';
import { useContext, useState } from 'react';
import manifest from '../../ornaments/manifest.json';
import type { DecorationsSectionProps, LogoConfig } from '../../types';

const moods: Record<string, string> = { 全部: 'All', 清雅: 'Serenity', 春意: 'Spring', 秋意: 'Autumn', 隐逸: 'Retreat', 思乡: 'Homesickness', 喜庆: 'Celebration', 孤寂: 'Solitude' };
const categories: Record<string, string> = { 花木: 'Botanicals', 山水: 'Landscapes', 禽鸟: 'Birds', 器物: 'Objects', 景舍: 'Dwellings', 纹样: 'Patterns' };
const anchors = { tl: ['左上', 'Top left'], tr: ['右上', 'Top right'], bl: ['左下', 'Bottom left'], br: ['右下', 'Bottom right'], bc: ['底部居中', 'Bottom center'] };
const chip = 'rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-700 hover:border-stone-400 aria-pressed:bg-(--app-accent-700) aria-pressed:text-white';

export function OrnamentLibrary({ decorations }: { decorations: DecorationsSectionProps }) {
  const [mood, setMood] = useState('全部');
  const [selected, setSelected] = useContext(OrnamentSelection);
  const layers = decorations.logos.filter(item => item.ornamentId);
  const active = layers.find(item => item.id === selected) ?? layers.at(-1);
  const zh = decorations.language.startsWith('zh');
  const label = (chinese: string, english: string) => zh ? chinese : english;
  const title = (item: typeof manifest[number]) => label(item.name_zh, item.name_en);
  const frame = decorations.getFrameSize;
  function position(anchor: string, size: number, rotation = 0) {
    const { width, height } = frame();
    const radians = rotation * Math.PI / 180;
    const half = size * (Math.abs(Math.sin(radians)) + Math.abs(Math.cos(radians))) / 2;
    const x = Math.min(50, 3 + half / width * 100);
    const y = Math.min(50, 3 + half / height * 100);
    return {
      positionX: anchor.endsWith('l') ? x : anchor.endsWith('r') ? 100 - x : 50,
      positionY: anchor.startsWith('t') ? y : anchor.startsWith('b') ? 100 - y : 50,
    };
  }
  function add(item: typeof manifest[number]) {
    const { width, height } = frame();
    const size = Math.min(width, height) * item.default_scale;
    setSelected(decorations.onAddOrnament(item.file, {
      ornamentId: item.id, size, ...position(item.default_anchor, size),
    }));
  }
  function update(changes: Partial<LogoConfig>) {
    if (active) decorations.onLogoChange(active.id, changes);
  }
  return <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-3">
    <h3 className="font-medium">{label('装饰', 'Ornaments')}</h3>
    <div aria-live="polite" className="space-y-1 text-xs text-stone-600 empty:hidden">
      {layers.length > 2 && <p>{label('点缀宜少，诗是主体。', 'A little goes a long way. Let the poem lead.')}</p>}
      {layers.length > 4 && <p>{label('元素较多，可能喧宾夺主。', 'Several ornaments may draw attention away from the poem.')}</p>}
    </div>
    <div className="flex flex-wrap gap-1">{Object.entries(moods).map(([key, en]) =>
      <button className={chip} key={key} aria-pressed={mood === key} onClick={() => setMood(key)}>{label(key, en)}</button>)}</div>
    <div className="app-sidebar-scrollbar max-h-64 overflow-y-auto space-y-3">{Object.entries(categories).map(([key, en]) => {
      const items = manifest.filter(item => item.category === key && (mood === '全部' || item.moods.includes(mood)));
      return items.length > 0 && <section key={key}>
        <h4 className="mb-1 text-xs font-medium text-stone-600">{label(key, en)}</h4>
        <div className="grid grid-cols-3 gap-1">{items.map(item =>
          <button key={item.id} onClick={() => add(item)} className="rounded-md text-xs p-1 text-stone-700 hover:bg-stone-100">
            <img loading="lazy" className="mb-1 w-full h-16 object-contain rounded bg-[#eeece6]" src={'/ornaments/thumbs/' + item.id + '.webp'} alt="" />
            {title(item)}
          </button>)}</div>
      </section>;
    })}</div>
    {active && <div className="border-t pt-3 space-y-2 text-xs">
      <select className="app-select w-full" aria-label={label('已放置的装饰', 'Placed ornaments')} value={active.id} onChange={e => setSelected(e.target.value)}>
        {layers.map((layer, index) => {
          const item = manifest.find(entry => entry.id === layer.ornamentId);
          return <option key={layer.id} value={layer.id}>{index + 1}. {item ? title(item) : layer.ornamentId}</option>;
        })}
      </select>
      <div className="flex flex-wrap gap-1">{Object.entries(anchors).map(([key, names]) =>
        <button key={key} className={chip} onClick={() => update(position(key, active.size, active.rotation))}>{label(names[0], names[1])}</button>)}</div>
      <label className="flex items-center justify-between gap-2">{label('大小', 'Size')} <input type="range" min="12" max={Math.max(active.size, Math.min(frame().width, frame().height))} value={active.size} onChange={e => update({ size: +e.target.value })}/></label>
      <label className="flex items-center justify-between gap-2">{label('旋转', 'Rotation')} <input type="range" min="-180" max="180" value={active.rotation} onChange={e => update({ rotation: +e.target.value })}/></label>
      <label className="flex items-center justify-between gap-2">{label('透明度', 'Opacity')} <input type="range" min="0" max="1" step=".01" value={active.opacity} onChange={e => update({ opacity: +e.target.value })}/></label>
      <div className="flex flex-wrap gap-1">
        <button className={chip} aria-pressed={!!active.flipped} onClick={() => update({ flipped: !active.flipped })}>{label('水平翻转', 'Flip horizontally')}</button>
        <button className={chip} onClick={() => update({ aboveText: !active.aboveText })}>{active.aboveText ? label('置于文字之下', 'Move below text') : label('置于文字之上', 'Move above text')}</button>
        <button className={chip} onClick={() => setSelected(decorations.onAddOrnament(active.imageUrl, { ...active, positionX: Math.min(97, active.positionX + 2) }))}>{label('复制', 'Duplicate')}</button>
        <button className={chip} onClick={() => decorations.onLogoRemove(active.id)}>{label('删除', 'Delete')}</button>
      </div>
    </div>}
  </section>;
}
