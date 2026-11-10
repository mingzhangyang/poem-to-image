import type { Language } from './translations';

interface TemplateSyncMessages {
  loadFailed: string;
  mutationFailed: string;
  cacheFailed: string;
  retry: string;
  syncing: string;
  legacyWarning: string;
  importLegacy: string;
}

const messages: Record<Language, TemplateSyncMessages> = {
  en: {
    loadFailed: 'Could not refresh your saved templates. Existing cached templates are unchanged.',
    mutationFailed: 'The template change was not confirmed by the server. Please retry the action.',
    cacheFailed: 'Template storage is unavailable or invalid. Your existing saved data has not been deleted.',
    retry: 'Retry sync',
    syncing: 'Syncing saved templates…',
    legacyWarning: 'Older templates were stored without an account identity and may belong to a previously signed-in account on this browser. They are not loaded automatically.',
    importLegacy: 'Review and import older templates into guest library',
  },
  'zh-CN': {
    loadFailed: '无法刷新云端模板，现有缓存未被清除。',
    mutationFailed: '模板修改未获服务器确认，请重新操作。',
    cacheFailed: '模板本地存储不可用或数据无效，原有记录未被删除。',
    retry: '重试同步',
    syncing: '正在同步已保存的模板…',
    legacyWarning: '旧版模板没有账户归属记录，可能来自这台设备上曾登录的账户，因此不会自动加载。',
    importLegacy: '确认并将旧模板导入访客模板库',
  },
  'zh-TW': {
    loadFailed: '無法更新雲端範本，現有快取未被清除。',
    mutationFailed: '範本變更未獲伺服器確認，請重新操作。',
    cacheFailed: '範本本機儲存不可用或資料無效，原有資料尚未刪除。',
    retry: '重試同步',
    syncing: '正在同步已儲存的範本…',
    legacyWarning: '舊版範本沒有帳戶歸屬記錄，可能來自這台裝置曾登入的帳戶，因此不會自動載入。',
    importLegacy: '確認並匯入舊範本至訪客範本庫',
  },
  ja: {
    loadFailed: '保存済みテンプレートを更新できません。既存のキャッシュは保持されています。',
    mutationFailed: 'テンプレートの変更がサーバーで確認されませんでした。もう一度お試しください。',
    cacheFailed: 'テンプレート保存領域を利用できないか、データが無効です。既存データは削除されていません。',
    retry: '同期を再試行',
    syncing: 'テンプレートを同期中…',
    legacyWarning: '旧形式のテンプレートにはアカウント情報がなく、このブラウザーで以前利用した別のアカウントのものかもしれません。自動読み込みはしません。',
    importLegacy: '確認してゲスト用ライブラリに旧テンプレートを取り込む',
  },
  ko: {
    loadFailed: '저장된 템플릿을 새로고침할 수 없습니다. 기존 캐시는 유지됩니다.',
    mutationFailed: '템플릿 변경이 서버에서 확인되지 않았습니다. 다시 시도하세요.',
    cacheFailed: '템플릿 저장소를 사용할 수 없거나 데이터가 잘못되었습니다. 기존 데이터는 삭제되지 않았습니다.',
    retry: '동기화 재시도',
    syncing: '저장된 템플릿 동기화 중…',
    legacyWarning: '이전 템플릿에는 계정 정보가 없어 이 브라우저에서 다른 계정이 사용한 데이터일 수 있습니다. 자동으로 불러오지 않습니다.',
    importLegacy: '확인 후 이전 템플릿을 게스트 라이브러리로 가져오기',
  },
  es: {
    loadFailed: 'No se pudieron actualizar las plantillas. La caché existente se ha conservado.',
    mutationFailed: 'El servidor no confirmó el cambio de plantilla. Vuelve a intentarlo.',
    cacheFailed: 'El almacenamiento de plantillas no está disponible o no es válido. No se borraron los datos existentes.',
    retry: 'Reintentar sincronización',
    syncing: 'Sincronizando plantillas guardadas…',
    legacyWarning: 'Las plantillas antiguas no tenían identidad de cuenta; podrían pertenecer a otra cuenta usada en este navegador. No se cargan automáticamente.',
    importLegacy: 'Revisar e importar plantillas antiguas para invitados',
  },
  fr: {
    loadFailed: 'Impossible d’actualiser les modèles. Le cache existant a été conservé.',
    mutationFailed: 'La modification du modèle n’a pas été confirmée par le serveur. Réessayez.',
    cacheFailed: 'Le stockage des modèles est indisponible ou invalide. Les données existantes ont été conservées.',
    retry: 'Réessayer la synchronisation',
    syncing: 'Synchronisation des modèles enregistrés…',
    legacyWarning: 'Les anciens modèles ne contiennent aucune identité de compte et peuvent appartenir à un autre compte utilisé sur ce navigateur. Ils ne sont pas chargés automatiquement.',
    importLegacy: 'Vérifier et importer les anciens modèles en mode invité',
  },
  de: {
    loadFailed: 'Gespeicherte Vorlagen konnten nicht aktualisiert werden. Der vorhandene Cache bleibt erhalten.',
    mutationFailed: 'Die Vorlagenänderung wurde nicht vom Server bestätigt. Bitte erneut versuchen.',
    cacheFailed: 'Der Vorlagenspeicher ist nicht verfügbar oder ungültig. Vorhandene Daten wurden nicht gelöscht.',
    retry: 'Synchronisierung wiederholen',
    syncing: 'Gespeicherte Vorlagen werden synchronisiert…',
    legacyWarning: 'Ältere Vorlagen haben keine Kontozuordnung und könnten zu einem früher verwendeten Konto gehören. Sie werden nicht automatisch geladen.',
    importLegacy: 'Alte Vorlagen prüfen und in die Gastbibliothek importieren',
  },
};

export function getTemplateSyncMessages(language: Language): TemplateSyncMessages {
  return messages[language];
}
