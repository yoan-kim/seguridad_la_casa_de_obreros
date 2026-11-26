import React, { useState } from 'react';
import {
  FileSpreadsheet,
  ExternalLink,
  Download,
  Copy,
  Check,
  PlusCircle,
  Code2,
  LogOut,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { InspectionLogEntry, Language, TRANSLATIONS } from '../i18n';
import { APPS_SCRIPT_TEMPLATE } from '../services/googleSheetsService';

interface GoogleSheetsPanelProps {
  lang: Language;
  logs: InspectionLogEntry[];
  googleUser: User | null;
  isSigningIn: boolean;
  isCreatingSheet: boolean;
  spreadsheetId: string;
  webhookUrl: string;
  onSpreadsheetIdChange: (val: string) => void;
  onWebhookUrlChange: (val: string) => void;
  onGoogleSignIn: () => void;
  onGoogleLogout: () => void;
  onCreateNewSheet: () => void;
  onPreviewImage: (dataUrl: string, title: string) => void;
}

export const GoogleSheetsPanel: React.FC<GoogleSheetsPanelProps> = ({
  lang,
  logs,
  googleUser,
  isSigningIn,
  isCreatingSheet,
  spreadsheetId,
  webhookUrl,
  onSpreadsheetIdChange,
  onWebhookUrlChange,
  onGoogleSignIn,
  onGoogleLogout,
  onCreateNewSheet,
  onPreviewImage,
}) => {
  const t = TRANSLATIONS[lang];
  const [showWebhookGuide, setShowWebhookGuide] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const copyAppsScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const exportLogsToCsv = () => {
    if (logs.length === 0) return;
    const headers = [
      'Date',
      'Time',
      'Day (Ko)',
      'Day (Es)',
      'Inspector',
      '1. Main Gate Photo',
      '2. Front Door Photo',
      '3. Dining Iron Door Photo',
      '4. Lights Off Confirmed',
      'Notes',
      'Telegram Reported',
    ];
    const rows = logs.map((entry) => [
      entry.dateStr,
      entry.timeStr,
      entry.dayOfWeekKo,
      entry.dayOfWeekEs,
      entry.inspector,
      'Photo 1 Uploaded',
      'Photo 2 Uploaded',
      'Photo 3 Uploaded',
      entry.lightsOffConfirmed ? '네 / Sí' : 'No',
      `"${(entry.notes || '').replace(/"/g, '""')}"`,
      entry.telegramSent ? 'Yes' : 'No',
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temple_security_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cleanSheetId = spreadsheetId.includes('/spreadsheets/d/')
    ? spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || spreadsheetId
    : spreadsheetId.trim();

  const sheetExternalUrl = cleanSheetId
    ? `https://docs.google.com/spreadsheets/d/${cleanSheetId}/edit`
    : '';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
      {/* Header & Google Auth Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
            <h2 className="text-lg font-bold text-slate-900">{t.sheetSectionTitle}</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">{t.sheetSectionDesc}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!googleUser ? (
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={isSigningIn}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    ></path>
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    ></path>
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    ></path>
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    ></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">{t.googleSignInBtn}</span>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">
                {t.googleConnectedAs}{' '}
                <strong className="text-slate-900">{googleUser.email || googleUser.displayName}</strong>
              </span>
              <button
                type="button"
                onClick={onGoogleLogout}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-600 flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.googleDisconnectBtn}</span>
              </button>
            </div>
          )}

          {logs.length > 0 && (
            <button
              type="button"
              onClick={exportLogsToCsv}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.exportCsvBtn}</span>
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet ID & Zero-Login Webhook Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700">
              Google Spreadsheet ID / URL
            </label>
            {googleUser && (
              <button
                type="button"
                onClick={onCreateNewSheet}
                disabled={isCreatingSheet}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{isCreatingSheet ? '...' : t.createNewSheetBtn}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => onSpreadsheetIdChange(e.target.value)}
              placeholder={t.sheetIdPlaceholder}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {sheetExternalUrl && (
              <a
                href={sheetExternalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{t.openSheetExternalBtn}</span>
              </a>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700">
              {t.webhookUrlLabel}
            </label>
            <button
              type="button"
              onClick={() => setShowWebhookGuide(!showWebhookGuide)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>{t.webhookGuideBtn}</span>
            </button>
          </div>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => onWebhookUrlChange(e.target.value)}
            placeholder={t.webhookUrlPlaceholder}
            className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Collapsible Apps Script 1-Minute Setup Guide for GitHub Pages */}
      {showWebhookGuide && (
        <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-300">
              {lang === 'ko'
                ? '💡 GitHub Pages에서 8명의 봉사자가 구글 로그인 없이도 시트에 사진 3장과 기록을 자동 누적하는 방법'
                : '💡 Cómo acumular registros y 3 fotos en Google Sheets desde GitHub Pages sin pedir inicio de sesión'}
            </span>
            <button
              type="button"
              onClick={copyAppsScript}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold flex items-center gap-1.5"
            >
              {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedScript ? 'Copied!' : 'Copy Apps Script'}</span>
            </button>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-300">
            <li>
              {lang === 'ko'
                ? '기록을 누적할 구글 스프레드시트 상단 메뉴에서 [확장 프로그램] → [Apps Script]를 클릭합니다.'
                : 'En su Google Spreadsheet, abra [Extensiones] → [Apps Script].'}
            </li>
            <li>
              {lang === 'ko'
                ? '아래 코드를 붙여넣고 우측 상단 [배포] → [새 배포] → 유형: [웹 앱], 액세스 권한: [모든 사용자(Anyone)]로 배포합니다.'
                : 'Pegue el código de abajo y haga clic en [Implementar] → [Nueva implementación] → [Aplicación web] (Acceso: Cualquier persona).'}
            </li>
            <li>
              {lang === 'ko'
                ? '발급된 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 위 입력창에 붙여넣으면 끝납니다!'
                : 'Copie la URL generada y péguela en el campo Webhook arriba.'}
            </li>
          </ol>
          <pre className="p-3 rounded-lg bg-slate-950 text-slate-300 font-mono-tabular text-[11px] overflow-x-auto max-h-48">
            {APPS_SCRIPT_TEMPLATE}
          </pre>
        </div>
      )}

      {/* Cumulative Inspection Table */}
      <div className="overflow-x-auto">
        {logs.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl">
            <p className="text-xs text-slate-500">{t.emptyLogMessage}</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-3">{t.tableColDate}</th>
                <th className="py-2.5 px-3">{t.tableColInspector}</th>
                <th className="py-2.5 px-3">{t.tableColPhotos}</th>
                <th className="py-2.5 px-3">{t.tableColLights}</th>
                <th className="py-2.5 px-3">{t.tableColNotes}</th>
                <th className="py-2.5 px-3 text-right">{t.tableColStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {logs.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 font-mono-tabular whitespace-nowrap">
                    <div className="font-semibold text-slate-900">{entry.dateStr}</div>
                    <div className="text-[11px] text-slate-500">
                      {lang === 'ko' ? entry.dayOfWeekKo : entry.dayOfWeekEs} · {entry.timeStr}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                    {entry.inspector}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      {[
                        { url: entry.photos.mainGate, label: t.slot1Title },
                        { url: entry.photos.frontDoor, label: t.slot2Title },
                        { url: entry.photos.diningIronDoor, label: t.slot3Title },
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onPreviewImage(item.url, `${entry.dateStr} ${entry.inspector} - ${item.label}`)}
                          className="relative group w-11 h-11 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 cursor-pointer"
                          title={item.label}
                        >
                          <img
                            src={item.url}
                            alt={item.label}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-3.5 h-3.5 text-white" />
                          </span>
                          <span className="absolute bottom-0 right-0 bg-slate-900/80 text-white text-[9px] font-mono-tabular px-1">
                            {idx + 1}
                          </span>
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{t.lightsYesBadge}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 max-w-[180px] truncate">
                    {entry.notes || '-'}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap font-medium text-slate-600">
                    <span>{t.statusTelegramOk}</span>
                    {entry.sheetsSynced && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="text-emerald-700">{t.statusSheetOk}</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
