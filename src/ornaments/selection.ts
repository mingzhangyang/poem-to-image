import { createContext } from 'react';

export const OrnamentSelection = createContext<readonly [string, (id: string) => void]>(['', () => {}]);
