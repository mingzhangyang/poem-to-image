import { PenLine, Plus, Upload } from 'lucide-react';
import type { DecorationsSectionProps, TranslateFn } from '../../types';

interface AddElementActionsProps {
  t: TranslateFn;
  decorations: DecorationsSectionProps;
}

/** Buttons that add a text box, a signature or an uploaded logo to the card. */
export function AddElementActions({ t, decorations }: AddElementActionsProps) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[rgba(34,48,52,0.06)] bg-[linear-gradient(180deg,rgba(237,244,243,0.42),rgba(255,253,249,0.82))] p-2">
      <button
        type="button"
        onClick={decorations.onAddCustomText}
        className="app-action-button"
        title={t('addTextBox')}
        aria-label={t('addTextBox')}
      >
        <Plus className="h-3.5 w-3.5 shrink-0" />
      </button>

      <button
        type="button"
        onClick={decorations.onAddSignature}
        className="app-action-button"
        title={t('addSignature')}
        aria-label={t('addSignature')}
      >
        <PenLine className="h-3.5 w-3.5 shrink-0" />
      </button>

      <label
        className="app-action-button cursor-pointer"
        title={t('uploadLogo')}
      >
        <Upload className="h-3.5 w-3.5 shrink-0" />
        <input
          type="file"
          aria-label={t('uploadLogo')}
          accept="image/*"
          onChange={decorations.onLogoUpload}
          className="hidden"
        />
      </label>
    </div>
  );
}
