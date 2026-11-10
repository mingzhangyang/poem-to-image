import type { Language } from './translations';

interface TemplateSyncMessages {
  loadFailed: string;
  mutationFailed: string;
  cacheFailed: string;
  retry: string;
  syncing: string;
  saveUnavailable: string;
  reconcilePending: string;
  reconcileChecking: string;
  reconcileRefreshed: string;
  reconcileFailed: string;
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
    saveUnavailable: 'Sign-in is still loading or template storage is unavailable. Keep this name and save when the library is ready.',
    reconcilePending: 'A template change may have reached the server. Waiting to check the latest list; do not repeat it yet.',
    reconcileChecking: 'Checking the server for recent template changes…',
    reconcileRefreshed: 'The template list was refreshed from the server. Inspect it before repeating an uncertain save.',
    reconcileFailed: 'The server could not be checked. This list may be stale; retry synchronization before saving again.',
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
    saveUnavailable: '登录状态尚未就绪，或模板存储不可用。请保留名称，等待模板库可用后再保存。',
    reconcilePending: '模板变更可能已发送到服务器。正在等待核对最新列表，请勿立即重复操作。',
    reconcileChecking: '正在向服务器核对最近的模板修改…',
    reconcileRefreshed: '已从服务器刷新模板列表。请检查列表，再决定是否重新保存。',
    reconcileFailed: '无法核对服务器状态，当前列表可能已过期。请先重试同步，再考虑重新保存。',
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
    saveUnavailable: '登入狀態尚未就緒，或範本儲存空間不可用。請保留名稱，等範本庫可用後再儲存。',
    reconcilePending: '範本變更可能已傳至伺服器。正在等待核對最新清單，請勿立即重複操作。',
    reconcileChecking: '正在向伺服器核對最近的範本變更…',
    reconcileRefreshed: '已從伺服器更新範本清單。請先檢查，再決定是否重新儲存。',
    reconcileFailed: '無法核對伺服器狀態，目前清單可能已過期。請先重試同步，再考慮重新儲存。',
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
    saveUnavailable: '認証の読み込み中、またはテンプレートの保存領域が利用できません。名前を残し、準備ができてから保存してください。',
    reconcilePending: '変更はサーバーに届いている可能性があります。最新の一覧を確認するまで操作を繰り返さないでください。',
    reconcileChecking: 'サーバーに最近のテンプレート変更を確認しています…',
    reconcileRefreshed: 'サーバーから一覧を更新しました。保存操作を繰り返す前に内容を確認してください。',
    reconcileFailed: 'サーバーを確認できませんでした。表示中の一覧は古い可能性があります。保存し直す前に同期を再試行してください。',
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
    saveUnavailable: '로그인 확인 중이거나 템플릿 저장소를 사용할 수 없습니다. 이름을 그대로 두고 라이브러리가 준비되면 저장하세요.',
    reconcilePending: '변경 사항이 이미 서버에 도착했을 수 있습니다. 최신 목록을 확인하기 전에는 다시 저장하지 마세요.',
    reconcileChecking: '서버에서 최근 템플릿 변경 사항을 확인하는 중…',
    reconcileRefreshed: '서버에서 템플릿 목록을 새로고침했습니다. 다시 저장하기 전에 목록을 확인하세요.',
    reconcileFailed: '서버 상태를 확인하지 못했습니다. 표시된 목록이 오래되었을 수 있으니 다시 저장하기 전에 동기화를 재시도하세요.',
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
    saveUnavailable: 'La autenticación sigue cargando o el almacenamiento no está disponible. Conserva el nombre y guarda cuando la biblioteca esté lista.',
    reconcilePending: 'Es posible que el cambio haya llegado al servidor. Espera a comprobar la lista antes de repetirlo.',
    reconcileChecking: 'Comprobando los cambios recientes de plantillas en el servidor…',
    reconcileRefreshed: 'La lista se ha actualizado desde el servidor. Revísala antes de repetir un guardado incierto.',
    reconcileFailed: 'No se pudo consultar el servidor. La lista puede estar desactualizada; reintenta la sincronización antes de guardar de nuevo.',
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
    saveUnavailable: 'La connexion est en cours ou le stockage des modèles est indisponible. Conservez ce nom et enregistrez une fois la bibliothèque prête.',
    reconcilePending: 'La modification est peut-être déjà arrivée au serveur. Attendez la vérification de la liste avant de recommencer.',
    reconcileChecking: 'Vérification des dernières modifications sur le serveur…',
    reconcileRefreshed: 'La liste a été actualisée depuis le serveur. Vérifiez-la avant de répéter un enregistrement incertain.',
    reconcileFailed: 'Impossible de vérifier le serveur. La liste peut être obsolète ; relancez la synchronisation avant de réenregistrer.',
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
    saveUnavailable: 'Die Anmeldung lädt noch oder der Vorlagenspeicher ist nicht verfügbar. Behalten Sie den Namen bei und speichern Sie, sobald die Bibliothek bereit ist.',
    reconcilePending: 'Die Änderung wurde möglicherweise bereits an den Server gesendet. Warten Sie die Prüfung der aktuellen Liste ab, bevor Sie sie wiederholen.',
    reconcileChecking: 'Aktuelle Vorlagenänderungen werden auf dem Server geprüft…',
    reconcileRefreshed: 'Die Vorlagenliste wurde vom Server aktualisiert. Prüfen Sie sie vor einem erneuten Speicherversuch.',
    reconcileFailed: 'Der Server konnte nicht geprüft werden. Die Liste ist möglicherweise veraltet; synchronisieren Sie erneut, bevor Sie erneut speichern.',
    legacyWarning: 'Ältere Vorlagen haben keine Kontozuordnung und könnten zu einem früher verwendeten Konto gehören. Sie werden nicht automatisch geladen.',
    importLegacy: 'Alte Vorlagen prüfen und in die Gastbibliothek importieren',
  },
};

export function getTemplateSyncMessages(language: Language): TemplateSyncMessages {
  return messages[language];
}
