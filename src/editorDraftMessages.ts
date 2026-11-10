import type { Language } from './translations';

interface DraftSafetyMessages {
  loading: string;
  loadFailed: string;
  retryLoading: string;
  saveFailed: string;
  saveConflict: string;
  retrySaving: string;
}

const messages: Record<Language, DraftSafetyMessages> = {
  en: {
    loading: 'Restoring your saved artwork…',
    loadFailed: 'Your saved artwork could not be opened safely. Nothing has been overwritten. Check browser storage permissions, then retry.',
    retryLoading: 'Retry loading',
    saveFailed: 'Your latest changes have not been saved. Keep this tab open and retry.',
    saveConflict: 'Another tab saved a newer artwork. This tab will not overwrite it. Export or copy your changes before reloading.',
    retrySaving: 'Retry saving',
  },
  'zh-CN': {
    loading: '正在恢复已保存的作品…',
    loadFailed: '无法安全读取已保存的作品。原有数据未被覆盖，请检查浏览器存储权限后重试。',
    retryLoading: '重新读取',
    saveFailed: '最新修改尚未保存。请保持此页面打开，并重试保存。',
    saveConflict: '另一个标签页已保存了更新的作品。为避免覆盖，请先导出或复制本页修改，再重新加载。',
    retrySaving: '重试保存',
  },
  'zh-TW': {
    loading: '正在還原已儲存的作品…',
    loadFailed: '無法安全讀取已儲存的作品。原有資料尚未被覆寫，請檢查瀏覽器儲存權限後重試。',
    retryLoading: '重新讀取',
    saveFailed: '最新修改尚未儲存。請保持此頁面開啟並重試。',
    saveConflict: '另一個分頁已儲存較新的作品。本頁不會覆寫，請先匯出或複製修改再重新載入。',
    retrySaving: '重試儲存',
  },
  ja: {
    loading: '保存した作品を復元しています…',
    loadFailed: '保存した作品を安全に開けませんでした。データは上書きされていません。ブラウザーの保存設定を確認して再試行してください。',
    retryLoading: '読み込みを再試行',
    saveFailed: '最新の変更は保存されていません。このタブを開いたまま再試行してください。',
    saveConflict: '別のタブで新しい作品が保存されました。上書きを防ぐため、変更をエクスポートしてから再読み込みしてください。',
    retrySaving: '保存を再試行',
  },
  ko: {
    loading: '저장된 작품을 복원하는 중…',
    loadFailed: '저장된 작품을 안전하게 열 수 없습니다. 기존 데이터는 덮어쓰지 않았습니다. 브라우저 저장소 설정을 확인하고 다시 시도하세요.',
    retryLoading: '다시 불러오기',
    saveFailed: '최근 변경 사항이 저장되지 않았습니다. 이 탭을 열어 두고 다시 시도하세요.',
    saveConflict: '다른 탭에서 더 최신 작품을 저장했습니다. 덮어쓰지 않도록 변경 사항을 내보낸 뒤 새로고침하세요.',
    retrySaving: '저장 재시도',
  },
  es: {
    loading: 'Restaurando la obra guardada…',
    loadFailed: 'No se pudo abrir la obra guardada de forma segura. No se sobrescribieron datos. Comprueba el almacenamiento del navegador e inténtalo de nuevo.',
    retryLoading: 'Reintentar carga',
    saveFailed: 'Los últimos cambios no se han guardado. Mantén esta pestaña abierta y vuelve a intentarlo.',
    saveConflict: 'Otra pestaña guardó una versión más reciente. Exporta o copia tus cambios antes de recargar.',
    retrySaving: 'Reintentar guardado',
  },
  fr: {
    loading: 'Restauration de votre œuvre enregistrée…',
    loadFailed: 'Impossible d’ouvrir votre œuvre en toute sécurité. Aucune donnée n’a été écrasée. Vérifiez le stockage du navigateur et réessayez.',
    retryLoading: 'Réessayer le chargement',
    saveFailed: 'Vos dernières modifications ne sont pas enregistrées. Gardez cet onglet ouvert et réessayez.',
    saveConflict: 'Un autre onglet a enregistré une version plus récente. Exportez ou copiez vos modifications avant de recharger.',
    retrySaving: 'Réessayer l’enregistrement',
  },
  de: {
    loading: 'Gespeichertes Werk wird wiederhergestellt…',
    loadFailed: 'Das gespeicherte Werk konnte nicht sicher geöffnet werden. Es wurden keine Daten überschrieben. Prüfe den Browserspeicher und versuche es erneut.',
    retryLoading: 'Erneut laden',
    saveFailed: 'Deine letzten Änderungen wurden nicht gespeichert. Lass diesen Tab geöffnet und versuche es erneut.',
    saveConflict: 'Ein anderer Tab hat eine neuere Version gespeichert. Exportiere oder kopiere deine Änderungen vor dem Neuladen.',
    retrySaving: 'Speichern wiederholen',
  },
};

export function getDraftSafetyMessages(language: Language): DraftSafetyMessages {
  return messages[language];
}
