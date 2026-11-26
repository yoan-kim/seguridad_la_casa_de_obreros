export type Language = 'ko' | 'es';

export const INSPECTORS = [
  'Daniel',
  'Daniela',
  'Ernan',
  'Joselin',
  'Lia',
  'Lucia',
  'Miguel',
  'Selina',
] as const;

export type InspectorName = (typeof INSPECTORS)[number];

export type DayOfWeekIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sun, 1 = Mon, ..., 6 = Sat

export type WeeklySchedule = Record<DayOfWeekIndex, InspectorName>;

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  1: 'Daniel',   // Monday / Lunes
  2: 'Daniela',  // Tuesday / Martes
  3: 'Ernan',    // Wednesday / Miércoles
  4: 'Joselin',  // Thursday / Jueves
  5: 'Lia',      // Friday / Viernes
  6: 'Lucia',    // Saturday / Sábado
  0: 'Miguel',   // Sunday / Domingo (Selina also available in dropdown or custom schedule)
};

export interface PhotoSlotData {
  dataUrl: string;
  fileName: string;
  timestamp: string;
  width: number;
  height: number;
  sizeKb: number;
}

export interface InspectionLogEntry {
  id: string;
  dateStr: string;
  timeStr: string;
  dayOfWeekKo: string;
  dayOfWeekEs: string;
  inspector: InspectorName;
  photos: {
    mainGate: string;       // 1. 대문
    frontDoor: string;      // 2. 현관문
    diningIronDoor: string; // 3. 식당 철문
  };
  lightsOffConfirmed: boolean;
  notes: string;
  telegramSent: boolean;
  sheetsSynced: boolean;
  sheetRowMode?: 'oauth' | 'webhook' | 'local';
}

export const TRANSLATIONS = {
  ko: {
    appTitle: '성전 보안 관리',
    appSubtitle: '일일 출입문 잠금 및 소등 점검 보고 시스템',
    navInspection: '일일 보안 점검',
    navSchedule: '요일별 담당자 배정',
    navSheetLog: '구글 시트 누적 기록',
    navSettings: '연동 설정',
    langKo: '한국어 (Ko)',
    langEs: 'Español (Es)',
    todayLabel: '오늘 점검일',
    recommendedInspector: '오늘 요일 추천 담당자',
    applyRecommended: '추천 담당자 자동 선택',
    inspectorSectionTitle: '00. 담당자 선택',
    inspectorSectionDesc: '오늘 보안 점검을 수행하는 담당자 이름을 선택해주세요. (요일 담당자가 자동 추천되며 변경 가능합니다)',
    inspectorSelectPlaceholder: '담당자를 선택하세요',
    changeInspectorHint: '드롭다운을 눌러 다른 담당자로 변경할 수 있습니다.',
    photoSectionTitle: '01–03. 보안 구역 사진 촬영 및 업로드',
    photoSectionDesc: '각 구역의 잠금 상태를 확인하고 카메라 버튼으로 직접 촬영하거나 사진을 업로드해주세요. (자동 압축 적용)',
    slot1Title: '1. 대문',
    slot1Subtitle: 'Puerta Principal · 정문 잠금 상태 확인',
    slot2Title: '2. 현관문',
    slot2Subtitle: 'Puerta de Entrada · 본관 현관 잠금 상태 확인',
    slot3Title: '3. 식당 철문',
    slot3Subtitle: 'Puerta de Hierro del Comedor · 식당 출입 철문 잠금 확인',
    btnTakePhoto: '카메라로 바로 찍기',
    btnUploadGallery: '앨범에서 사진 선택',
    btnRetakePhoto: '다시 찍기',
    btnRemovePhoto: '삭제',
    photoUploadedStatus: '촬영 및 압축 완료',
    photoPendingStatus: '사진 업로드 필요',
    compressingPhoto: '모바일 전송용 이미지 최적화 중...',
    cameraModalTitle: '실시간 카메라 촬영',
    cameraCaptureBtn: '사진 촬영하기',
    cameraSwitchBtn: '전/후면 전환',
    cameraCloseBtn: '닫기',
    cameraFallbackHint: '카메라 접근이 제한된 환경에서는 휴대폰 기본 카메라 앱이 바로 실행됩니다.',
    section4Title: '04. 성전 및 계단 소등 최종 확인',
    section4Question: '성전 및 2층 계단쪽 불 등 불필요한 모든 불을 껐습니까?',
    section4YesLabel: '네 (모든 불을 확인하고 껐습니다)',
    section4RequiredWarning: '위 "네" 체크박스를 선택해야만 텔레그램 보고하기 버튼이 활성화됩니다.',
    notesLabel: '특이사항 / 메모 (선택 사항)',
    notesPlaceholder: '특이사항이나 전달할 메모가 있다면 적어주세요 (예: 2층 창문 잠금 추가 확인 완료)',
    checklistHeading: '보고 전 필수 항목 완료 상태',
    checkItemInspector: '담당자 선택',
    checkItemSlot1: '1. 대문 사진',
    checkItemSlot2: '2. 현관문 사진',
    checkItemSlot3: '3. 식당 철문 사진',
    checkItemLights: '4. 소등 확인 ("네" 체크)',
    submitBtnReady: '텔레그램으로 보고하기 (에스드라스 봇 & 시트 기록)',
    submitBtnDisabled: '모든 사진(3장) 업로드 및 4번 소등 체크를 완료해주세요',
    submittingBtn: '에스드라스 봇 보고 및 구글 시트 기록 중...',
    submitSuccessTitle: '텔레그램 보고 및 시트 누적 기록 완료!',
    submitSuccessDesc: '에스드라스(Esdras) 봇이 소주제방(23703)에 완료 메시지를 전송했으며, 점검 내역이 누적 대장에 기록되었습니다.',
    newInspectionBtn: '새로운 점검 작성하기',
    scheduleCardTitle: '요일별 담당자 배정표',
    scheduleCardDesc: '요일별 기본 담당자를 지정하면 해당 요일에 접속 시 자동으로 이름이 선택됩니다.',
    editScheduleBtn: '배정표 수정',
    saveScheduleBtn: '배정표 저장',
    days: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
    daysShort: ['일', '월', '화', '수', '목', '금', '토'],
    sheetSectionTitle: '구글 스프레드시트 누적 점검 대장',
    sheetSectionDesc: '날짜, 담당자, 사진 3장(대문/현관문/식당 철문), 소등 체크 여부가 날짜별로 누적됩니다.',
    googleSignInBtn: 'Google 계정으로 스프레드시트 연결',
    googleConnectedAs: '연결된 계정:',
    googleDisconnectBtn: '연결 해제',
    createNewSheetBtn: '새 보안 점검 스프레드시트 자동 생성',
    openSheetExternalBtn: '구글 스프레드시트 열기',
    exportCsvBtn: 'CSV(엑셀) 다운로드',
    sheetIdPlaceholder: '연동할 구글 스프레드시트 ID 또는 URL 입력',
    webhookUrlLabel: '무인증 자동 기록 웹훅 URL (GitHub Pages 봉사자용 선택 옵션)',
    webhookUrlPlaceholder: 'https://script.google.com/macros/s/.../exec',
    webhookGuideBtn: '1분 웹훅 설정 가이드 보기',
    tableColDate: '날짜 / 시간',
    tableColInspector: '담당자',
    tableColPhotos: '촬영 사진 (대문 · 현관 · 식당)',
    tableColLights: '소등 확인',
    tableColNotes: '특이사항',
    tableColStatus: '전송 상태',
    lightsYesBadge: '네 (완료)',
    statusTelegramOk: '텔레그램 완료',
    statusSheetOk: '시트 기록됨',
    emptyLogMessage: '아직 누적된 보안 점검 기록이 없습니다. 첫 점검을 완료하고 보고해보세요.',
    confirmSyncModalTitle: '구글 스프레드시트에 점검 내역을 기록하시겠습니까?',
    confirmSyncModalDesc: '연결된 구글 스프레드시트에 오늘 날짜, 담당자, 사진 3장 및 소등 확인("네") 데이터를 새로운 행으로 추가합니다.',
    confirmBtn: '확인 및 전송',
    cancelBtn: '취소',
    telegramTargetInfo: '보고 대상: 성전 보안 소주제방 (t.me/c/2256338393/23703) · 봇: Esdras (에스드라스)',
    telegramPreviewLabel: '텔레그램 소주제방 전송 메시지 미리보기',
  },
  es: {
    appTitle: 'Seguridad del Templo',
    appSubtitle: 'Sistema de Informe Diario de Puertas y Apagado de Luces',
    navInspection: 'Inspección Diaria',
    navSchedule: 'Horario por Día',
    navSheetLog: 'Registro en Google Sheets',
    navSettings: 'Configuración',
    langKo: '한국어 (Ko)',
    langEs: 'Español (Es)',
    todayLabel: 'Fecha de Inspección',
    recommendedInspector: 'Encargado recomendado hoy',
    applyRecommended: 'Elegir recomendado',
    inspectorSectionTitle: '00. Selección de Encargado',
    inspectorSectionDesc: 'Seleccione su nombre en el menú desplegable. (El encargado del día se sugiere automáticamente, pero puede cambiarlo).',
    inspectorSelectPlaceholder: 'Seleccione al encargado',
    changeInspectorHint: 'Puede cambiar el nombre usando el menú desplegable en cualquier momento.',
    photoSectionTitle: '01–03. Fotografías de Puntos de Seguridad',
    photoSectionDesc: 'Tome una foto directamente con el botón de cámara o suba una foto de su teléfono para cada puerta. (Compresión automática).',
    slot1Title: '1. Puerta Principal (대문)',
    slot1Subtitle: 'Verificación de cierre de la puerta principal exterior',
    slot2Title: '2. Puerta de Entrada (현관문)',
    slot2Subtitle: 'Verificación de cierre de la entrada al edificio',
    slot3Title: '3. Puerta de Hierro del Comedor (식당 철문)',
    slot3Subtitle: 'Verificación de cierre de la puerta metálica del comedor',
    btnTakePhoto: 'Tomar Foto Directa',
    btnUploadGallery: 'Subir de Galería',
    btnRetakePhoto: 'Tomar de Nuevo',
    btnRemovePhoto: 'Eliminar',
    photoUploadedStatus: 'Foto lista y optimizada',
    photoPendingStatus: 'Falta subir fotografía',
    compressingPhoto: 'Optimizando imagen para envío rápido...',
    cameraModalTitle: 'Cámara en Vivo',
    cameraCaptureBtn: 'Capturar Foto',
    cameraSwitchBtn: 'Cambiar Cámara',
    cameraCloseBtn: 'Cerrar',
    cameraFallbackHint: 'Se abrirá directamente la cámara de su teléfono móvil.',
    section4Title: '04. Verificación Final de Apagado de Luces',
    section4Question: '¿Ha apagado todas las luces innecesarias, incluidas las del templo y las escaleras del segundo piso?',
    section4YesLabel: 'Sí (He verificado y apagado todas las luces)',
    section4RequiredWarning: 'Debe marcar la casilla "Sí" para poder enviar el informe por Telegram.',
    notesLabel: 'Notas / Observaciones (Opcional)',
    notesPlaceholder: 'Escriba cualquier novedad u observación opcional...',
    checklistHeading: 'Requisitos antes de enviar el informe',
    checkItemInspector: 'Encargado elegido',
    checkItemSlot1: '1. Foto Puerta Principal',
    checkItemSlot2: '2. Foto Puerta Entrada',
    checkItemSlot3: '3. Foto Puerta Comedor',
    checkItemLights: '4. Luces apagadas ("Sí")',
    submitBtnReady: 'Enviar Informe por Telegram (Bot Esdras y Google Sheets)',
    submitBtnDisabled: 'Suba las 3 fotos y marque la casilla "Sí" de las luces para activar',
    submittingBtn: 'Enviando a Telegram (Esdras) y guardando en Google Sheets...',
    submitSuccessTitle: '¡Informe enviado a Telegram y guardado en Sheets!',
    submitSuccessDesc: 'El bot Esdras publicó el mensaje de confirmación en el tema (23703) y los datos con las 3 fotos se acumularon en la hoja.',
    newInspectionBtn: 'Realizar Nueva Inspección',
    scheduleCardTitle: 'Horario Semanal de Encargados',
    scheduleCardDesc: 'El encargado asignado a cada día de la semana se selecciona automáticamente al abrir la aplicación.',
    editScheduleBtn: 'Editar Horario',
    saveScheduleBtn: 'Guardar Horario',
    days: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    daysShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    sheetSectionTitle: 'Registro Acumulativo en Google Spreadsheets',
    sheetSectionDesc: 'Se acumulan por fecha: encargado, las 3 fotografías y la confirmación de apagado de luces.',
    googleSignInBtn: 'Conectar con Google Sheets',
    googleConnectedAs: 'Conectado como:',
    googleDisconnectBtn: 'Desconectar',
    createNewSheetBtn: 'Crear Nueva Hoja de Seguridad Automáticamente',
    openSheetExternalBtn: 'Abrir Google Spreadsheet',
    exportCsvBtn: 'Descargar CSV (Excel)',
    sheetIdPlaceholder: 'ID o URL de Google Spreadsheet',
    webhookUrlLabel: 'URL de Webhook Google Apps Script (Opcional para GitHub Pages sin login)',
    webhookUrlPlaceholder: 'https://script.google.com/macros/s/.../exec',
    webhookGuideBtn: 'Ver guía rápida de Webhook (1 min)',
    tableColDate: 'Fecha / Hora',
    tableColInspector: 'Encargado',
    tableColPhotos: '3 Fotos (Principal · Entrada · Comedor)',
    tableColLights: 'Luces Apagadas',
    tableColNotes: 'Observaciones',
    tableColStatus: 'Estado',
    lightsYesBadge: 'Sí (Confirmado)',
    statusTelegramOk: 'Telegram OK',
    statusSheetOk: 'Guardado en Sheet',
    emptyLogMessage: 'Aún no hay registros acumulados. Complete la primera inspección arriba.',
    confirmSyncModalTitle: '¿Guardar registro en Google Spreadsheets y enviar a Telegram?',
    confirmSyncModalDesc: 'Se agregará una nueva fila en Google Sheets con la fecha, encargado, 3 fotos y confirmación de luces ("Sí"), y el bot Esdras enviará el aviso.',
    confirmBtn: 'Confirmar y Enviar',
    cancelBtn: 'Cancelar',
    telegramTargetInfo: 'Destino: Grupo de Seguridad Tema (t.me/c/2256338393/23703) · Bot: Esdras',
    telegramPreviewLabel: 'Vista previa del mensaje en Telegram',
  },
} as const;
