import type { Language } from './translations';
import type { PoemContentData } from './types';

export const DEFAULT_POEMS: Record<Language, PoemContentData> = {
  'zh-CN': {
    title: '静夜思',
    author: '唐·李白',
    body: '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',
    sourceNote: '',
  },
  'zh-TW': {
    title: '靜夜思',
    author: '唐·李白',
    body: '床前明月光，\n疑是地上霜。\n舉頭望明月，\n低頭思故鄉。',
    sourceNote: '',
  },
  en: {
    title: 'Sonnet 18',
    author: 'William Shakespeare',
    body: 'Shall I compare thee to a summer\'s day?\nThou art more lovely and more temperate.\nRough winds do shake the darling buds of May,\nAnd summer\'s lease hath all too short a date.',
    sourceNote: '',
  },
  ja: {
    title: '春はあけぼの',
    author: '清少納言',
    body: '春はあけぼの。\nやうやう白くなりゆく山ぎは、\n少し明かりて、\n紫だちたる雲の細くたなびきたる。',
    sourceNote: '『枕草子』',
  },
  ko: {
    title: '청산리 벽계수야',
    author: '황진이',
    body: '청산리 벽계수야\n수이 감을 자랑 마라\n일도 창해하면\n다시 오기 어려워라',
    sourceNote: '',
  },
  es: {
    title: 'Cultivo una rosa blanca',
    author: 'José Martí',
    body: 'Cultivo una rosa blanca\nen julio como en enero\npara el amigo sincero\nque me da su mano franca.',
    sourceNote: '',
  },
  fr: {
    title: 'Demain, dès l\'aube',
    author: 'Victor Hugo',
    body: 'Demain, dès l\'aube, à l\'heure où blanchit la campagne,\nJe partirai. Vois-tu, je sais que tu m\'attends.\nJ\'irai par la forêt, j\'irai par la montagne.\nJe ne puis demeurer loin de toi plus longtemps.',
    sourceNote: '',
  },
  de: {
    title: 'Wandrers Nachtlied',
    author: 'Johann Wolfgang von Goethe',
    body: 'Über allen Gipfeln\nIst Ruh,\nIn allen Wipfeln\nSpürest du\nKaum einen Hauch.',
    sourceNote: '',
  },
};
