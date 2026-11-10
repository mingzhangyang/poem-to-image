import type { Language } from './translations';

interface TemplateSyncMessages {
  loadFailed: string;
  mutationFailed: string;
  cacheFailed: string;
  retry: string;
  syncing: string;
  legacyWarning: string;
  legacyImportBlocked: string;
  importLegacy: string;
}

const messages: Record<Language, TemplateSyncMessages> = {
  en: {
    loadFailed: 'Could not refresh your saved templates. Existing cached templates are unchanged.',
    mutationFailed: 'The server may already have saved the change, even if its confirmation was lost. Retry sync and inspect the refreshed list before repeating the action to avoid duplicate templates.',
    legacyImportBlocked: 'Save current guest edits with Retry sync before importing older templates. Unsaved edits will not be replaced.',
    cacheFailed: 'Template storage is unavailable or invalid. Your existing saved data has not been deleted.',
    retry: 'Retry sync',
    syncing: 'Syncing saved templates…',
    legacyWarning: 'Older templates were stored without an account identity and may belong to a previously signed-in account on this browser. They are not loaded automatically.',
    importLegacy: 'Review and import older templates into guest library',
  },
  'zh-CN': {
    loadFailed: '无法刷新云端模板，现有缓存未被清除。',
    mutationFailed: '服务器可能已保存模板变更，只是确认响应丢失。请先重试同步并检查刷新后的模板列表，确认尚未成功后再重复操作，以免创建重复模板。',
    legacyImportBlocked: '导入旧模板前，请先通过“重试同步”保存当前访客编辑。未保存的修改不会被覆盖。',
    cacheFailed: '模板本地存储不可用或数据无效，原有记录未被删除。',
    retry: '重试同步',
    syncing: '正在同步已保存的模板…',
    legacyWarning: '旧版模板没有账户归属记录，可能来自这台设备上曾登录的账户，因此不会自动加载。',
    importLegacy: '确认并将旧模板导入访客模板库',
  },
  'zh-TW': {
    loadFailed: '無法更新雲端範本，現有快取未被清除。',
    mutationFailed: '伺服器可能已儲存範本變更，只是確認回應遺失。請先重試同步並查看更新後的範本清單，確認尚未成功再重新操作，以免建立重複範本。',
    legacyImportBlocked: '匯入舊範本前，請先透過「重試同步」儲存目前訪客編輯。未儲存的修改不會被覆蓋。',
    cacheFailed: '範本本機儲存不可用或資料無效，原有資料尚未刪除。',
    retry: '重試同步',
    syncing: '正在同步已儲存的範本…',
    legacyWarning: '舊版範本沒有帳戶歸屬記錄，可能來自這台裝置曾登入的帳戶，因此不會自動載入。',
    importLegacy: '確認並匯入舊範本至訪客範本庫',
  },
  ja: {
    loadFailed: '保存済みテンプレートを更新できません。既存のキャッシュは保持されています。',
    mutationFailed: '応答が失われた場合、サーバーにはすでに保存されている可能性があります。操作を繰り返す前に同期を再試行し、更新後のテンプレート一覧を確認して重複作成を防いでください。',
    legacyImportBlocked: '古いテンプレートを取り込む前に「同期を再試行」で現在のゲスト編集を保存してください。未保存の変更は上書きしません。',
    cacheFailed: 'テンプレート保存領域を利用できないか、データが無効です。既存データは削除されていません。',
    retry: '同期を再試行',
    syncing: 'テンプレートを同期中…',
    legacyWarning: '旧形式のテンプレートにはアカウント情報がなく、このブラウザーで以前利用した別のアカウントのものかもしれません。自動読み込みはしません。',
    importLegacy: '確認してゲスト用ライブラリに旧テンプレートを取り込む',
  },
  ko: {
    loadFailed: '저장된 템플릿을 새로고침할 수 없습니다. 기존 캐시는 유지됩니다.',
    mutationFailed: '응답이 누락되어도 서버에 변경 사항이 이미 저장되었을 수 있습니다. 중복 생성을 방지하려면 작업을 반복하기 전에 동기화를 다시 시도하고 새로고침된 템플릿 목록을 확인하세요.',
    legacyImportBlocked: '이전 템플릿을 가져오기 전에 「동기화 재시도」로 현재 게스트 편집을 저장하세요. 저장되지 않은 변경 사항은 덮어쓰지 않습니다.',
    cacheFailed: '템플릿 저장소를 사용할 수 없거나 데이터가 잘못되었습니다. 기존 데이터는 삭제되지 않았습니다.',
    retry: '동기화 재시도',
    syncing: '저장된 템플릿 동기화 중…',
    legacyWarning: '이전 템플릿에는 계정 정보가 없어 이 브라우저에서 다른 계정이 사용한 데이터일 수 있습니다. 자동으로 불러오지 않습니다.',
    importLegacy: '확인 후 이전 템플릿을 게스트 라이브러리로 가져오기',
  },
  es: {
    loadFailed: 'No se pudieron actualizar las plantillas. La caché existente se ha conservado.',
    mutationFailed: 'Es posible que el servidor haya guardado el cambio aunque no llegara la confirmación. Reintenta la sincronización y revisa la lista actualizada antes de repetir la acción para evitar duplicados.',
    legacyImportBlocked: 'Guarda los cambios actuales de invitado con Reintentar sincronización antes de importar plantillas antiguas. No se sobrescribirán cambios sin guardar.',
    cacheFailed: 'El almacenamiento de plantillas no está disponible o no es válido. No se borraron los datos existentes.',
    retry: 'Reintentar sincronización',
    syncing: 'Sincronizando plantillas guardadas…',
    legacyWarning: 'Las plantillas antiguas no tenían identidad de cuenta; podrían pertenecer a otra cuenta usada en este navegador. No se cargan automáticamente.',
    importLegacy: 'Revisar e importar plantillas antiguas para invitados',
  },
  fr: {
    loadFailed: 'Impossible d’actualiser les modèles. Le cache existant a été conservé.',
    mutationFailed: 'Le serveur a peut-être enregistré la modification malgré l’absence de confirmation. Relancez la synchronisation et vérifiez la liste actualisée avant de recommencer, pour éviter les doublons.',
    legacyImportBlocked: 'Enregistrez les modifications de l’invité avec Réessayer la synchronisation avant d’importer les anciens modèles. Les modifications non enregistrées ne seront pas écrasées.',
    cacheFailed: 'Le stockage des modèles est indisponible ou invalide. Les données existantes ont été conservées.',
    retry: 'Réessayer la synchronisation',
    syncing: 'Synchronisation des modèles enregistrés…',
    legacyWarning: 'Les anciens modèles ne contiennent aucune identité de compte et peuvent appartenir à un autre compte utilisé sur ce navigateur. Ils ne sont pas chargés automatiquement.',
    importLegacy: 'Vérifier et importer les anciens modèles en mode invité',
  },
  de: {
    loadFailed: 'Gespeicherte Vorlagen konnten nicht aktualisiert werden. Der vorhandene Cache bleibt erhalten.',
    mutationFailed: 'Die Änderung wurde möglicherweise bereits auf dem Server gespeichert, obwohl die Bestätigung ausblieb. Synchronisieren Sie erneut und prüfen Sie die aktualisierte Vorlagenliste, bevor Sie die Aktion wiederholen, um Duplikate zu vermeiden.',
    legacyImportBlocked: 'Speichern Sie aktuelle Gaständerungen mit Synchronisierung wiederholen, bevor Sie ältere Vorlagen importieren. Ungespeicherte Änderungen werden nicht überschrieben.',
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
