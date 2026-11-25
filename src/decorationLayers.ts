import type { CustomText, LogoConfig } from './types';

export type LayerDirection = 'up' | 'down' | 'top' | 'bottom';
type LayerKind = 'customText' | 'logo';

function buildOrderedLayers(customTexts: CustomText[], logos: LogoConfig[]) {
  return [
    ...customTexts.map((item, index) => ({
      id: item.id,
      kind: 'customText' as const,
      band: 'legacy',
      zIndex: item.zIndex ?? index,
      order: index,
    })),
    ...logos.map((item, index) => ({
      id: item.id,
      kind: 'logo' as const,
      band: item.ornamentId ? (item.aboveText ? 'above' : 'below') : 'legacy',
      zIndex: item.zIndex ?? customTexts.length + index,
      order: customTexts.length + index,
    })),
  ].sort((left, right) => (left.zIndex - right.zIndex) || (left.order - right.order));
}

export function normalizeDecorationLayers(customTexts: CustomText[], logos: LogoConfig[]) {
  const layerMap = new Map(
    buildOrderedLayers(customTexts, logos).map((item, index) => [`${item.kind}:${item.id}`, index]),
  );

  return {
    customTexts: customTexts.map((item) => ({
      ...item,
      zIndex: layerMap.get(`customText:${item.id}`) ?? 0,
    })),
    logos: logos.map((item) => ({
      ...item,
      zIndex: layerMap.get(`logo:${item.id}`) ?? 0,
    })),
  };
}

export function getNextLayerIndex(customTexts: CustomText[], logos: LogoConfig[]) {
  const orderedLayers = buildOrderedLayers(customTexts, logos);
  return orderedLayers.length === 0 ? 0 : orderedLayers[orderedLayers.length - 1].zIndex + 1;
}

export function moveLayer(
  customTexts: CustomText[],
  logos: LogoConfig[],
  targetKind: LayerKind,
  targetId: string,
  direction: LayerDirection,
) {
  const orderedLayers = buildOrderedLayers(customTexts, logos);
  const selected = orderedLayers.find((item) => item.kind === targetKind && item.id === targetId);
  if (!selected) {
    return normalizeDecorationLayers(customTexts, logos);
  }

  // Preview and export paint ornaments below/above the legacy layer stack.
  // Only layers in the same paint band can exchange their visible order.
  const reordered = orderedLayers.filter((item) => item.band === selected.band);
  const currentIndex = reordered.indexOf(selected);
  const [target] = reordered.splice(currentIndex, 1);

  if (direction === 'top') {
    reordered.push(target);
  } else if (direction === 'bottom') {
    reordered.unshift(target);
  } else if (direction === 'up') {
    reordered.splice(Math.min(reordered.length, currentIndex + 1), 0, target);
  } else {
    reordered.splice(Math.max(0, currentIndex - 1), 0, target);
  }

  // Keep all other bands in their original slots, including their relative order.
  let bandIndex = 0;
  const merged = orderedLayers.map((item) => item.band === selected.band ? reordered[bandIndex++] : item);
  const layerMap = new Map(merged.map((item, index) => [`${item.kind}:${item.id}`, index]));

  return {
    customTexts: customTexts.map((item) => ({
      ...item,
      zIndex: layerMap.get(`customText:${item.id}`) ?? item.zIndex ?? 0,
    })),
    logos: logos.map((item) => ({
      ...item,
      zIndex: layerMap.get(`logo:${item.id}`) ?? item.zIndex ?? 0,
    })),
  };
}
