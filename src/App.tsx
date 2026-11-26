/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Send,
  CheckCircle2,
  AlertCircle,
  LightbulbOff,
  UserCheck,
  MessageSquare,
  ExternalLink,
  X,
  RotateCcw,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  DayOfWeekIndex,
  DEFAULT_WEEKLY_SCHEDULE,
  INSPECTORS,
  InspectionLogEntry,
  InspectorName,
  Language,
  PhotoSlotData,
  TRANSLATIONS,
  WeeklySchedule,
} from './i18n';
import { PhotoUploadSlot } from './components/PhotoUploadSlot';
import { WeeklyScheduleCard } from './components/WeeklyScheduleCard';
import { GoogleSheetsPanel } from './components/GoogleSheetsPanel';
import {
  buildTelegramSummaryMessage,
  DEFAULT_TELEGRAM_CONFIG,
  sendTelegramSummaryReport,
} from './services/telegramService';
import {
  appendInspectionToGoogleSheets,
  createSecuritySpreadsheet,
  googleSignIn,
  initAuth,
  logout,
} from './services/googleSheetsService';

const STORAGE_KEYS = {
  LANG: 'temple_sec_lang_v1',
  SCHEDULE: 'temple_sec_schedule_v1',
  LOGS: 'temple_sec_logs_v1',
  SHEET_ID: 'temple_sec_sheet_id_v1',
  WEBHOOK_URL: 'temple_sec_webhook_url_v1',
};

export default function App() {
  // 1. Bilingual language state (Ko / Es)
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LANG);
    return saved === 'es' || saved === 'ko' ? saved : 'ko';
  });

  const t = TRANSLATIONS[lang];

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem(STORAGE_KEYS.LANG, newLang);
  };

  // 2. Date & Day-of-week schedule auto-recommendation
  const now = new Date();
  const todayIndex = now.getDay() as DayOfWeekIndex;
  const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`;

  const [schedule, setSchedule] = useState<WeeklySchedule>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_WEEKLY_SCHEDULE;
  });

  const recommendedToday: InspectorName = schedule[todayIndex] || 'Daniel';

  // 3. Inspection Form State
  const [selectedInspector, setSelectedInspector] = useState<InspectorName>(recommendedToday);
  const [photoSlot1, setPhotoSlot1] = useState<PhotoSlotData | null>(null); // 1. 대문
  const [photoSlot2, setPhotoSlot2] = useState<PhotoSlotData | null>(null); // 2. 현관문
  const [photoSlot3, setPhotoSlot3] = useState<PhotoSlotData | null>(null); // 3. 식당 철문
  const [lightsOffConfirmed, setLightsOffConfirmed] = useState<boolean>(false); // 4. 모든 불을 껐습니까? "네"
  const [notes, setNotes] = useState<string>('');

  // 4. Submission & Modal States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [previewModal, setPreviewModal] = useState<{ url: string; title: string } | null>(null);

  // 5. Google Sheets & Cumulative Logs State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);

  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.SHEET_ID) || '';
  });

  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || '';
  });

  const [logs, setLogs] = useState<InspectionLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => setGoogleUser(user),
      () => setGoogleUser(null)
    );
    return () => unsubscribe();
  }, []);

  const handleUpdateSchedule = (newSchedule: WeeklySchedule) => {
    setSchedule(newSchedule);
    localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(newSchedule));
  };

  const handleSpreadsheetIdChange = (val: string) => {
    setSpreadsheetId(val);
    localStorage.setItem(STORAGE_KEYS.SHEET_ID, val);
  };

  const handleWebhookUrlChange = (val: string) => {
    setWebhookUrl(val);
    localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, val);
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setSubmitError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Google Sign-In failed');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setGoogleUser(null);
  };

  const handleCreateNewSpreadsheet = async () => {
    setIsCreatingSheet(true);
    setSubmitError(null);
    try {
      let tokenUser = googleUser;
      let accessToken: string | null = null;
      if (!tokenUser) {
        const res = await googleSignIn();
        if (res) {
          setGoogleUser(res.user);
          accessToken = res.accessToken;
        }
      } else {
        const { getAccessToken } = await import('./services/googleSheetsService');
        accessToken = await getAccessToken();
      }

      if (!accessToken) {
        throw new Error('Google authentication token required.');
      }

      const created = await createSecuritySpreadsheet(accessToken);
      handleSpreadsheetIdChange(created.spreadsheetId);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to create Google Spreadsheet');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Strict Validation Gate: All 3 photos + 4th lights-off "Yes" checkbox must be completed
  const isAllValid = Boolean(
    selectedInspector &&
      photoSlot1 &&
      photoSlot2 &&
      photoSlot3 &&
      lightsOffConfirmed === true
  );

  const completedCount =
    (photoSlot1 ? 1 : 0) +
    (photoSlot2 ? 1 : 0) +
    (photoSlot3 ? 1 : 0) +
    (lightsOffConfirmed ? 1 : 0);

  const handleTriggerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllValid || isSubmitting) return;

    // If mutating a connected Google Sheet (OAuth or Webhook), show explicit confirmation modal
    const willMutateGoogleSheet = Boolean(
      (googleUser && spreadsheetId.trim()) ||
        webhookUrl.trim().startsWith('https://script.google.com')
    );

    if (willMutateGoogleSheet) {
      setShowConfirmModal(true);
    } else {
      executeReportSubmission();
    }
  };

  const executeReportSubmission = async () => {
    if (!photoSlot1 || !photoSlot2 || !photoSlot3 || !lightsOffConfirmed) return;

    setShowConfirmModal(false);
    setIsSubmitting(true);
    setSubmitError(null);

    const submitTime = new Date();
    const timeStr = submitTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const dayOfWeekKo = TRANSLATIONS.ko.days[todayIndex];
    const dayOfWeekEs = TRANSLATIONS.es.days[todayIndex];

    const cleanSheetId = spreadsheetId.includes('/spreadsheets/d/')
      ? spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || spreadsheetId
      : spreadsheetId.trim();

    const sheetUrl = cleanSheetId
      ? `https://docs.google.com/spreadsheets/d/${cleanSheetId}/edit`
      : undefined;

    try {
      // 1. Send summary completion message to Telegram topic 23703 via Esdras Bot
      const telegramRes = await sendTelegramSummaryReport({
        inspector: selectedInspector,
        dateStr: formattedDate,
        timeStr,
        dayOfWeekKo,
        dayOfWeekEs,
        notes,
        sheetUrl,
      });

      if (!telegramRes.ok) {
        throw new Error(
          lang === 'ko'
            ? `텔레그램 전송 실패: ${telegramRes.error}`
            : `Error al enviar a Telegram: ${telegramRes.error}`
        );
      }

      // 2. Build cumulative entry (Date, Inspector, 3 Photos, Lights Off Checkbox)
      const newEntry: InspectionLogEntry = {
        id: `log_${Date.now()}`,
        dateStr: formattedDate,
        timeStr,
        dayOfWeekKo,
        dayOfWeekEs,
        inspector: selectedInspector,
        photos: {
          mainGate: photoSlot1.dataUrl,
          frontDoor: photoSlot2.dataUrl,
          diningIronDoor: photoSlot3.dataUrl,
        },
        lightsOffConfirmed: true,
        notes: notes.trim(),
        telegramSent: true,
        sheetsSynced: false,
      };

      // 3. Append row to Google Sheets (via OAuth API or Apps Script Webhook)
      const sheetSyncRes = await appendInspectionToGoogleSheets(newEntry, {
        spreadsheetId,
        webhookUrl,
      });

      newEntry.sheetsSynced = sheetSyncRes.synced;
      newEntry.sheetRowMode = sheetSyncRes.mode || 'local';

      // 4. Persist to cumulative local history (keep up to 30 most recent entries with compressed thumbnails)
      const updatedLogs = [newEntry, ...logs].slice(0, 30);
      setLogs(updatedLogs);
      try {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updatedLogs));
      } catch {
        // If localStorage quota reached, store latest 10
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updatedLogs.slice(0, 10)));
      }

      setSubmitSuccess(true);
    } catch (err: any) {
      setSubmitError(err?.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFormForNewInspection = () => {
    setPhotoSlot1(null);
    setPhotoSlot2(null);
    setPhotoSlot3(null);
    setLightsOffConfirmed(false);
    setNotes('');
    setSubmitSuccess(false);
    setSubmitError(null);
  };

  const previewTelegramText = buildTelegramSummaryMessage({
    inspector: selectedInspector,
    dateStr: formattedDate,
    timeStr: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dayOfWeekKo: TRANSLATIONS.ko.days[todayIndex],
    dayOfWeekEs: TRANSLATIONS.es.days[todayIndex],
    notes,
  }).replace(/\*/g, '');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: Zone 1 (Brand) — Zone 2 (Nav Links) — Zone 3 (Bilingual Language Switcher) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single wordmark */}
        <a
          href="#inspection-form"
          className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          {t.appTitle}
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#inspection-form"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            {t.navInspection}
          </a>
          <a
            href="#weekly-schedule"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            {t.navSchedule}
          </a>
          <a
            href="#sheets-log"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            {t.navSheetLog}
          </a>
        </nav>

        {/* Zone 3: Language Switcher Tab (Ko / Es) */}
        <div
          role="tablist"
          aria-label="Language Switcher"
          className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={lang === 'ko'}
            onClick={() => handleLanguageChange('ko')}
            className={`min-h-[34px] px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              lang === 'ko'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.langKo}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={lang === 'es'}
            onClick={() => handleLanguageChange('es')}
            className={`min-h-[34px] px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              lang === 'es'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.langEs}
          </button>
        </div>
      </header>

      {/* Main Content Container: Full 1440px Responsive 2-Column Architecture */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* Top Context Strip: Date, Day-of-Week Recommended Inspector, and Progress */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="font-mono-tabular font-semibold text-slate-800">
                {formattedDate} ({t.days[todayIndex]})
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {t.recommendedInspector}:{' '}
                <strong className="text-blue-700">{recommendedToday}</strong>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {t.appTitle} — {t.appSubtitle}
            </h1>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-xs font-medium text-slate-500">
                {lang === 'ko' ? '필수 점검 진행률' : 'Progreso de Inspección'}
              </div>
              <div className="text-lg font-extrabold font-mono-tabular text-slate-900">
                {completedCount} / 4{' '}
                <span className="text-xs font-semibold text-slate-500">
                  ({Math.round((completedCount / 4) * 100)}%)
                </span>
              </div>
            </div>
            <a
              href={DEFAULT_TELEGRAM_CONFIG.topicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              <span>Telegram (23703)</span>
            </a>
          </div>
        </section>

        {/* Primary 2-Column Split: Left = 4-Step Inspection Form | Right = Weekly Schedule & Telegram Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (7 cols): 00 Inspector Dropdown + 01-03 Photo Slots + 04 Lights Checkbox + Submit */}
          <form
            id="inspection-form"
            onSubmit={handleTriggerSubmit}
            className="lg:col-span-7 space-y-6"
          >
            {/* Step 00: Inspector Dropdown with Day-of-Week Auto-Suggestion */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-blue-700 shrink-0" />
                    <h2 className="text-base font-bold text-slate-900">
                      {t.inspectorSectionTitle}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{t.inspectorSectionDesc}</p>
                </div>

                {selectedInspector !== recommendedToday && (
                  <button
                    type="button"
                    onClick={() => setSelectedInspector(recommendedToday)}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {t.applyRecommended} ({recommendedToday})
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <select
                    aria-label={t.inspectorSectionTitle}
                    value={selectedInspector}
                    onChange={(e) => setSelectedInspector(e.target.value as InspectorName)}
                    className="w-full min-h-[52px] px-4 py-3 rounded-xl border border-slate-300 bg-slate-50/50 hover:bg-white text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors cursor-pointer"
                  >
                    {INSPECTORS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                        {name === recommendedToday
                          ? lang === 'ko'
                            ? ` — ★ 오늘(${t.days[todayIndex]}) 담당 추천`
                            : ` — ★ Recomendado hoy (${t.days[todayIndex]})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-slate-500">{t.changeInspectorHint}</p>
              </div>
            </div>

            {/* Steps 01, 02, 03: Three Security Door Photo Upload & Direct Camera Capture Slots */}
            <div className="space-y-4">
              <div className="px-1">
                <h2 className="text-base font-bold text-slate-900">{t.photoSectionTitle}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{t.photoSectionDesc}</p>
              </div>

              {/* 1. 대문 (Puerta Principal) */}
              <PhotoUploadSlot
                slotNumber={1}
                title={t.slot1Title}
                subtitle={t.slot1Subtitle}
                lang={lang}
                photo={photoSlot1}
                onPhotoChange={setPhotoSlot1}
                onPreviewImage={(url, title) => setPreviewModal({ url, title })}
              />

              {/* 2. 현관문 (Puerta de Entrada) */}
              <PhotoUploadSlot
                slotNumber={2}
                title={t.slot2Title}
                subtitle={t.slot2Subtitle}
                lang={lang}
                photo={photoSlot2}
                onPhotoChange={setPhotoSlot2}
                onPreviewImage={(url, title) => setPreviewModal({ url, title })}
              />

              {/* 3. 식당 철문 (Puerta de Hierro del Comedor) */}
              <PhotoUploadSlot
                slotNumber={3}
                title={t.slot3Title}
                subtitle={t.slot3Subtitle}
                lang={lang}
                photo={photoSlot3}
                onPhotoChange={setPhotoSlot3}
                onPreviewImage={(url, title) => setPreviewModal({ url, title })}
              />
            </div>

            {/* Step 04: Mandatory Single "Yes (네 / Sí)" Checkbox for Turning Off All Unnecessary Lights */}
            <div
              className={`rounded-2xl border p-5 sm:p-6 transition-colors space-y-4 ${
                lightsOffConfirmed
                  ? 'bg-white border-emerald-300'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-mono-tabular font-semibold ${
                      lightsOffConfirmed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-white'
                    }`}
                  >
                    04
                  </span>
                  <h2 className="text-base font-bold text-slate-900">{t.section4Title}</h2>
                </div>
                <LightbulbOff
                  className={`w-5 h-5 shrink-0 ${
                    lightsOffConfirmed ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <p className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                  “{t.section4Question}”
                </p>

                {/* Single unique "네 / Sí" checkbox with generous 52px touch hitbox */}
                <label
                  htmlFor="lights-off-yes-checkbox"
                  className={`min-h-[54px] px-4 py-3 rounded-xl border flex items-center gap-3.5 cursor-pointer select-none transition-all ${
                    lightsOffConfirmed
                      ? 'bg-emerald-50/90 border-emerald-500 text-emerald-950 shadow-2xs'
                      : 'bg-white border-slate-300 hover:border-slate-400 text-slate-900'
                  }`}
                >
                  <input
                    id="lights-off-yes-checkbox"
                    type="checkbox"
                    checked={lightsOffConfirmed}
                    onChange={(e) => setLightsOffConfirmed(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer shrink-0"
                  />
                  <span className="text-sm sm:text-base font-bold">
                    {t.section4YesLabel}
                  </span>
                </label>

                {!lightsOffConfirmed && (
                  <p className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.section4RequiredWarning}</span>
                  </p>
                )}
              </div>

              {/* Optional Remarks / Notes Field */}
              <div className="pt-2 space-y-1.5">
                <label
                  htmlFor="optional-notes"
                  className="text-xs font-semibold text-slate-700 block"
                >
                  {t.notesLabel}
                </label>
                <textarea
                  id="optional-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.notesPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Pre-flight Requirement Checklist & Bottom Telegram Submit Button */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-600">
                  {t.checklistHeading}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  {[
                    { label: `${t.checkItemInspector} (${selectedInspector})`, ok: Boolean(selectedInspector) },
                    { label: t.checkItemSlot1, ok: Boolean(photoSlot1) },
                    { label: t.checkItemSlot2, ok: Boolean(photoSlot2) },
                    { label: t.checkItemSlot3, ok: Boolean(photoSlot3) },
                    { label: t.checkItemLights, ok: lightsOffConfirmed },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border flex items-center gap-1.5 font-medium ${
                        item.ok
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          item.ok ? 'text-emerald-600' : 'text-slate-300'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {submitError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {submitSuccess ? (
                <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-300 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950">
                        {t.submitSuccessTitle}
                      </h4>
                      <p className="text-xs text-emerald-800 mt-1">
                        {t.submitSuccessDesc}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={resetFormForNewInspection}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t.newInspectionBtn}</span>
                    </button>
                    <a
                      href={DEFAULT_TELEGRAM_CONFIG.topicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-white border border-emerald-300 hover:bg-emerald-100/50 text-emerald-900 text-xs font-bold flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Telegram (23703)</span>
                    </a>
                  </div>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={!isAllValid || isSubmitting}
                  className={`w-full min-h-[56px] px-6 py-3.5 rounded-xl text-sm sm:text-base font-bold flex items-center justify-center gap-2.5 transition-all ${
                    isAllValid && !isSubmitting
                      ? 'bg-blue-700 hover:bg-blue-800 active:scale-[0.99] text-white shadow-md shadow-blue-900/10 cursor-pointer'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5 shrink-0" />
                  <span>
                    {isSubmitting
                      ? t.submittingBtn
                      : isAllValid
                      ? t.submitBtnReady
                      : t.submitBtnDisabled}
                  </span>
                </button>
              )}

              <p className="text-[11px] text-slate-500 text-center">
                {t.telegramTargetInfo}
              </p>
            </div>
          </form>

          {/* RIGHT COLUMN (5 cols): Weekly Schedule Assignment Table & Telegram Esdras Message Preview */}
          <div id="weekly-schedule" className="lg:col-span-5 space-y-6">
            <WeeklyScheduleCard
              lang={lang}
              schedule={schedule}
              todayIndex={todayIndex}
              selectedInspector={selectedInspector}
              onSelectInspector={setSelectedInspector}
              onUpdateSchedule={handleUpdateSchedule}
            />

            {/* Live Preview of Esdras Bot Message to Topic 23703 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    {t.telegramPreviewLabel}
                  </h3>
                </div>
                <span className="text-[11px] font-mono-tabular text-slate-500">
                  Bot: Esdras · Topic #23703
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                {previewTelegramText}
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width Bottom Section: Google Spreadsheets Cumulative Log Table & Setup */}
        <section id="sheets-log">
          <GoogleSheetsPanel
            lang={lang}
            logs={logs}
            googleUser={googleUser}
            isSigningIn={isSigningIn}
            isCreatingSheet={isCreatingSheet}
            spreadsheetId={spreadsheetId}
            webhookUrl={webhookUrl}
            onSpreadsheetIdChange={handleSpreadsheetIdChange}
            onWebhookUrlChange={handleWebhookUrlChange}
            onGoogleSignIn={handleGoogleSignIn}
            onGoogleLogout={handleGoogleLogout}
            onCreateNewSheet={handleCreateNewSpreadsheet}
            onPreviewImage={(url, title) => setPreviewModal({ url, title })}
          />
        </section>
      </main>

      {/* Mandatory User Confirmation Dialog before Mutating Google Sheets */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t.confirmSyncModalTitle}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {t.confirmSyncModalDesc}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div>
                <strong>{t.tableColDate}:</strong> {formattedDate} ({t.days[todayIndex]})
              </div>
              <div>
                <strong>{t.tableColInspector}:</strong> {selectedInspector}
              </div>
              <div>
                <strong>{t.tableColPhotos}:</strong> 1. {t.slot1Title} · 2. {t.slot2Title} · 3.{' '}
                {t.slot3Title}
              </div>
              <div>
                <strong>{t.tableColLights}:</strong> {t.lightsYesBadge}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                onClick={executeReportSubmission}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold cursor-pointer"
              >
                {t.confirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Lightbox Modal */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 text-white">
              <span className="text-sm font-semibold truncate">{previewModal.title}</span>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 bg-black flex items-center justify-center max-h-[75vh]">
              <img
                src={previewModal.url}
                alt={previewModal.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
