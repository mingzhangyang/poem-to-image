import en from './locales/en';

export type TranslationMessages = { [K in keyof typeof en]: string };
