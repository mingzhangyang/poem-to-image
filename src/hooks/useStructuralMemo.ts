import { useRef } from 'react';

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;

  if (aIsArray) {
    const aArr = a as unknown[];
    const bArr = b as unknown[];
    if (aArr.length !== bArr.length) return false;
    return aArr.every((item, index) => isDeepEqual(item, bArr[index]));
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(bObj, key) && isDeepEqual(aObj[key], bObj[key]),
  );
}

/**
 * Returns a referentially stable copy of `value`, only swapping in the new object
 * when it differs structurally (deep equality) from the previous render's value.
 *
 * Unlike `useMemo`, there is no dependency array to keep in sync — the value is
 * rebuilt every render from its source data, so a forgotten field can never make
 * the result stale. The trade-off is a deep comparison per render, which is cheap
 * relative to the canvas re-render the result drives.
 */
export function useStructuralMemo<T>(value: T): T {
  const ref = useRef(value);
  if (!isDeepEqual(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
}
