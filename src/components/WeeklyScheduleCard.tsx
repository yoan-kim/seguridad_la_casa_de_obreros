import React, { useState, useRef, useMemo } from 'react';
import {
  Calendar,
  Plus,
  RotateCcw,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Send,
  Link2,
  Unlink2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  DateRosterEntry,
  DayOfWeekIndex,
  INSPECTORS,
  InspectorName,
  Language,
  OFFICIAL_DATE_ROSTER,
  TRANSLATIONS,
} from '../i18n';
import {
  buildTelegramRosterListText,
  formatRosterHeaderDateRange,
  sendTelegramRosterList,
} from '../services/telegramService';

interface WeeklyScheduleCardProps {
  lang: Language;
  todayDateStr: string;
  todayIndex: DayOfWeekIndex;
  roster: DateRosterEntry[];
  selectedInspector: InspectorName;
  onSelectInspector: (inspector: InspectorName) => void;
  onUpdateRoster: (newRoster: DateRosterEntry[]) => void;
}

/**
 * Formats YYYY-MM-DD into DateRosterEntry fields (shortDate MM/DD and dayOfWeekIdx 0..6)
 */
function buildEntryFromDateStr(
  dateStr: string,
  inspector: InspectorName
): DateRosterEntry {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const dayOfWeekIdx = dateObj.getDay() as DayOfWeekIndex;

  return {
    dateStr: `${dateObj.getFullYear()}-${mm}-${dd}`,
    shortDate: `${mm}/${dd}`,
    dayOfWeekIdx,
    inspector,
  };
}

/**
 * Shifts a YYYY-MM-DD string by `deltaDays` (+1 for next day, -1 for previous day)
 */
function shiftDateString(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  dateObj.setDate(dateObj.getDate() + deltaDays);
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Difference in days between two YYYY-MM-DD strings (target - base)
 */
function diffDaysBetween(baseDateStr: string, targetDateStr: string): number {
  const [by, bm, bd] = baseDateStr.split('-').map(Number);
  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const baseUtc = Date.UTC(by, (bm || 1) - 1, bd || 1);
  const targetUtc = Date.UTC(ty, (tm || 1) - 1, td || 1);
  return Math.round((targetUtc - baseUtc) / (1000 * 60 * 60 * 24));
}

/**
 * Gets the next or previous inspector in strict alphabetical order:
 * Daniel -> Daniela -> Ernan -> Joselin -> Lia -> Lucia -> Miguel -> Selina
 */
function shiftInspectorAlphabetical(
  current: InspectorName,
  step: number
): InspectorName {
  const idx = INSPECTORS.indexOf(current);
  const safeIdx = idx === -1 ? 0 : idx;
  const mod =
    ((safeIdx + step) % INSPECTORS.length + INSPECTORS.length) %
    INSPECTORS.length;
  return INSPECTORS[mod];
}

/**
 * Ensures every single date between `rangeStart` and `rangeEnd` exists in `currentRoster`.
 * Any missing date before `currentRoster[0]` or after `currentRoster[last]` (or any gap)
 * is automatically generated in continuous alphabetical order!
 */
function ensureDateRangeInRoster(
  currentRoster: DateRosterEntry[],
  rangeStart: string,
  rangeEnd: string
): DateRosterEntry[] {
  const start = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
  const end = rangeStart <= rangeEnd ? rangeEnd : rangeStart;

  const sorted = [...currentRoster].sort((a, b) =>
    a.dateStr.localeCompare(b.dateStr)
  );
  const byDate = new Map<string, DateRosterEntry>();
  sorted.forEach((item) => byDate.set(item.dateStr, item));

  // Prepend missing dates before the earliest entry
  if (sorted.length > 0 && start < sorted[0].dateStr) {
    let cursorDate = sorted[0].dateStr;
    let cursorInspector = sorted[0].inspector;
    while (cursorDate > start) {
      cursorDate = shiftDateString(cursorDate, -1);
      cursorInspector = shiftInspectorAlphabetical(cursorInspector, -1);
      if (!byDate.has(cursorDate)) {
        byDate.set(
          cursorDate,
          buildEntryFromDateStr(cursorDate, cursorInspector)
        );
      }
    }
  }

  // Append missing dates after the latest entry
  if (sorted.length > 0 && end > sorted[sorted.length - 1].dateStr) {
    let cursorDate = sorted[sorted.length - 1].dateStr;
    let cursorInspector = sorted[sorted.length - 1].inspector;
    while (cursorDate < end) {
      cursorDate = shiftDateString(cursorDate, 1);
      cursorInspector = shiftInspectorAlphabetical(cursorInspector, 1);
      if (!byDate.has(cursorDate)) {
        byDate.set(
          cursorDate,
          buildEntryFromDateStr(cursorDate, cursorInspector)
        );
      }
    }
  }

  // Also fill any internal gaps inside [start, end]
  const totalDays = diffDaysBetween(start, end);
  let prevInspector: InspectorName =
    byDate.get(start)?.inspector || sorted[0]?.inspector || 'Miguel';

  for (let i = 0; i <= Math.min(totalDays, 120); i++) {
    const dStr = shiftDateString(start, i);
    const existing = byDate.get(dStr);
    if (existing) {
      prevInspector = existing.inspector;
    } else {
      const nextInsp = i === 0 ? prevInspector : shiftInspectorAlphabetical(prevInspector, 1);
      const created = buildEntryFromDateStr(dStr, nextInsp);
      byDate.set(dStr, created);
      prevInspector = nextInsp;
    }
  }

  return Array.from(byDate.values()).sort((a, b) =>
    a.dateStr.localeCompare(b.dateStr)
  );
}

export const WeeklyScheduleCard: React.FC<WeeklyScheduleCardProps> = ({
  lang,
  todayDateStr,
  roster,
  selectedInspector,
  onSelectInspector,
  onUpdateRoster,
}) => {
  const t = TRANSLATIONS[lang];
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // 1. Selected Start Date & End Date Filter State (defaults to the current roster bounds: 2026-11-25 ~ 2026-12-08)
  const [rangeStart, setRangeStart] = useState<string>(() =>
    roster.length > 0 ? roster[0].dateStr : '2026-11-25'
  );
  const [rangeEnd, setRangeEnd] = useState<string>(() =>
    roster.length > 0 ? roster[roster.length - 1].dateStr : '2026-12-08'
  );

  // Interactive Range Calendar Dropdown State
  const [isRangeCalendarOpen, setIsRangeCalendarOpen] = useState(false);
  const [selectionStep, setSelectionStep] = useState<'start' | 'end'>('start');
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Calendar Month Navigation State (year, month 0..11)
  const [calYear, setCalYear] = useState<number>(() => {
    const y = Number(rangeStart.split('-')[0]);
    return Number.isNaN(y) ? 2026 : y;
  });
  const [calMonth, setCalMonth] = useState<number>(() => {
    const m = Number(rangeStart.split('-')[1]);
    return Number.isNaN(m) ? 10 : m - 1; // 0-indexed (10 = November)
  });

  // 2. Cascade Alphabetical Toggle (when changing a row's dropdown, auto-update subsequent rows alphabetically)
  const [autoCascadeAlphabetical, setAutoCascadeAlphabetical] =
    useState<boolean>(true);

  // 3. Telegram Copy & Send State
  const [copiedList, setCopiedList] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [telegramFeedback, setTelegramFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Visible entries filtered by [rangeStart, rangeEnd]
  const visibleEntries = useMemo(() => {
    const start = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
    const end = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
    return roster.filter((r) => r.dateStr >= start && r.dateStr <= end);
  }, [roster, rangeStart, rangeEnd]);

  const lastVisible = visibleEntries[visibleEntries.length - 1] || roster[roster.length - 1];
  const firstVisible = visibleEntries[0] || roster[0];

  // Bottom Manual Add Seed Picker State
  const [showStartPicker, setShowStartPicker] = useState<boolean>(false);
  const [customStartDate, setCustomStartDate] = useState<string>(() =>
    lastVisible ? shiftDateString(lastVisible.dateStr, 1) : todayDateStr
  );
  const [customStartInspector, setCustomStartInspector] =
    useState<InspectorName>(() =>
      lastVisible
        ? shiftInspectorAlphabetical(lastVisible.inspector, 1)
        : 'Daniel'
    );

  const syncSeedPicker = (entries: DateRosterEntry[], currentEnd: string) => {
    const targetEntry =
      entries.find((e) => e.dateStr === currentEnd) ||
      entries[entries.length - 1];
    if (targetEntry) {
      setCustomStartDate(shiftDateString(targetEntry.dateStr, 1));
      setCustomStartInspector(
        shiftInspectorAlphabetical(targetEntry.inspector, 1)
      );
    }
  };

  /**
   * Calendar Day Click Handler:
   * - 1st click sets Start Date
   * - 2nd click sets End Date, auto-generates any missing dates in that range in alphabetical order, and closes calendar
   */
  const handleCalendarDayClick = (clickedDateStr: string) => {
    if (selectionStep === 'start') {
      setRangeStart(clickedDateStr);
      setRangeEnd(clickedDateStr);
      setSelectionStep('end');
    } else {
      const finalStart =
        clickedDateStr < rangeStart ? clickedDateStr : rangeStart;
      const finalEnd =
        clickedDateStr < rangeStart ? rangeStart : clickedDateStr;
      setRangeStart(finalStart);
      setRangeEnd(finalEnd);
      setSelectionStep('start');

      // Ensure all dates in [finalStart, finalEnd] exist in the roster (auto-generating missing rows alphabetically)
      const expandedRoster = ensureDateRangeInRoster(
        roster,
        finalStart,
        finalEnd
      );
      onUpdateRoster(expandedRoster);
      syncSeedPicker(expandedRoster, finalEnd);
      setIsRangeCalendarOpen(false);
    }
  };

  const navigateCalendarMonth = (delta: number) => {
    const d = new Date(calYear, calMonth + delta, 1);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  // Build calendar grid days for (calYear, calMonth)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(calYear, calMonth, 1);
    const startWeekday = firstDayOfMonth.getDay(); // 0 (Sun) .. 6 (Sat)
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    const cells: Array<{ dateStr: string; dayNum: number; inMonth: boolean }> =
      [];

    // Leading days from previous month
    const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const dObj = new Date(calYear, calMonth - 1, dNum);
      const yyyy = dObj.getFullYear();
      const mm = String(dObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dObj.getDate()).padStart(2, '0');
      cells.push({ dateStr: `${yyyy}-${mm}-${dd}`, dayNum: dNum, inMonth: false });
    }

    // Current month days
    for (let dNum = 1; dNum <= daysInMonth; dNum++) {
      const mm = String(calMonth + 1).padStart(2, '0');
      const dd = String(dNum).padStart(2, '0');
      cells.push({
        dateStr: `${calYear}-${mm}-${dd}`,
        dayNum: dNum,
        inMonth: true,
      });
    }

    // Trailing days to complete 6 rows or final week
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let dNum = 1; dNum <= remaining; dNum++) {
      const dObj = new Date(calYear, calMonth + 1, dNum);
      const yyyy = dObj.getFullYear();
      const mm = String(dObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dObj.getDate()).padStart(2, '0');
      cells.push({ dateStr: `${yyyy}-${mm}-${dd}`, dayNum: dNum, inMonth: false });
    }

    return cells;
  }, [calYear, calMonth]);

  /**
   * Add Next Sequential Day at the Bottom (+1 Day from current rangeEnd, +1 Alphabetical Inspector)
   */
  const handleAddNextDaySequential = () => {
    const baseEntry =
      roster.find((r) => r.dateStr === rangeEnd) ||
      roster[roster.length - 1];
    const targetDate = baseEntry
      ? shiftDateString(baseEntry.dateStr, 1)
      : todayDateStr;
    const targetInspector = baseEntry
      ? shiftInspectorAlphabetical(baseEntry.inspector, 1)
      : 'Daniel';

    const newEntry = buildEntryFromDateStr(targetDate, targetInspector);
    const existingIdx = roster.findIndex((r) => r.dateStr === targetDate);
    let updated: DateRosterEntry[];
    if (existingIdx !== -1) {
      updated = [...roster];
      updated[existingIdx] = newEntry;
    } else {
      updated = [...roster, newEntry].sort((a, b) =>
        a.dateStr.localeCompare(b.dateStr)
      );
    }

    onUpdateRoster(updated);
    setRangeEnd(targetDate);
    syncSeedPicker(updated, targetDate);

    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop =
          scrollContainerRef.current.scrollHeight;
      }
    }, 40);
  };

  /**
   * Add Previous Sequential Day at the Top (-1 Day from current rangeStart, -1 Alphabetical Inspector)
   */
  const handleAddPrevDaySequential = () => {
    const baseEntry =
      roster.find((r) => r.dateStr === rangeStart) || roster[0];
    const targetDate = baseEntry
      ? shiftDateString(baseEntry.dateStr, -1)
      : shiftDateString(todayDateStr, -1);
    const targetInspector = baseEntry
      ? shiftInspectorAlphabetical(baseEntry.inspector, -1)
      : 'Daniel';

    const newEntry = buildEntryFromDateStr(targetDate, targetInspector);
    const existingIdx = roster.findIndex((r) => r.dateStr === targetDate);
    let updated: DateRosterEntry[];
    if (existingIdx !== -1) {
      updated = [...roster];
      updated[existingIdx] = newEntry;
    } else {
      updated = [newEntry, ...roster].sort((a, b) =>
        a.dateStr.localeCompare(b.dateStr)
      );
    }

    onUpdateRoster(updated);
    setRangeStart(targetDate);

    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }, 40);
  };

  /**
   * Add from Bottom Calendar Start Date & Inspector Seed
   */
  const handleAddFromCalendarSeed = () => {
    if (!customStartDate) return;
    const newEntry = buildEntryFromDateStr(
      customStartDate,
      customStartInspector
    );

    const existingIdx = roster.findIndex((r) => r.dateStr === newEntry.dateStr);
    let updated: DateRosterEntry[];
    if (existingIdx !== -1) {
      updated = [...roster];
      updated[existingIdx] = newEntry;
    } else {
      updated = [...roster, newEntry].sort((a, b) =>
        a.dateStr.localeCompare(b.dateStr)
      );
    }

    onUpdateRoster(updated);
    if (customStartDate < rangeStart) setRangeStart(customStartDate);
    if (customStartDate > rangeEnd) setRangeEnd(customStartDate);

    // Advance by +1 day and +1 alphabetical inspector so repeated clicks add consecutive days
    const nextDate = shiftDateString(customStartDate, 1);
    const nextInspector = shiftInspectorAlphabetical(customStartInspector, 1);
    setCustomStartDate(nextDate);
    setCustomStartInspector(nextInspector);

    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop =
          scrollContainerRef.current.scrollHeight;
      }
    }, 40);
  };

  /**
   * Change a row's inspector via dropdown:
   * - If `autoCascadeAlphabetical` is ON, automatically updates all subsequent rows in alphabetical order!
   * - If OFF, only updates that specific date's row.
   */
  const handleRowInspectorChange = (
    targetDateStr: string,
    newInspector: InspectorName
  ) => {
    const targetIdx = roster.findIndex((r) => r.dateStr === targetDateStr);
    if (targetIdx === -1) return;

    const updated = roster.map((entry, idx) => {
      if (idx < targetIdx) return entry;
      if (idx === targetIdx) {
        return { ...entry, inspector: newInspector };
      }
      if (!autoCascadeAlphabetical) {
        return entry;
      }
      // Cascade alphabetical order for subsequent dates
      const step = idx - targetIdx;
      return {
        ...entry,
        inspector: shiftInspectorAlphabetical(newInspector, step),
      };
    });

    onUpdateRoster(updated);
    syncSeedPicker(updated, rangeEnd);
  };

  const handleRemoveRow = (targetDateStr: string) => {
    if (roster.length <= 1) return;
    const updated = roster.filter((r) => r.dateStr !== targetDateStr);
    onUpdateRoster(updated);
  };

  const handleResetDefault = () => {
    onUpdateRoster(OFFICIAL_DATE_ROSTER);
    setRangeStart(OFFICIAL_DATE_ROSTER[0].dateStr);
    setRangeEnd(OFFICIAL_DATE_ROSTER[OFFICIAL_DATE_ROSTER.length - 1].dateStr);
    syncSeedPicker(
      OFFICIAL_DATE_ROSTER,
      OFFICIAL_DATE_ROSTER[OFFICIAL_DATE_ROSTER.length - 1].dateStr
    );
    setTelegramFeedback(null);
  };

  // Formatted Telegram Roster Text for the selected [rangeStart, rangeEnd]
  const formattedTelegramList = useMemo(() => {
    return buildTelegramRosterListText(
      visibleEntries,
      TRANSLATIONS.ko.daysShort,
      TRANSLATIONS.es.daysShort
    );
  }, [visibleEntries]);

  const handleCopyRosterList = async () => {
    try {
      await navigator.clipboard.writeText(formattedTelegramList);
      setCopiedList(true);
      setTimeout(() => setCopiedList(false), 2500);
    } catch {
      // Fallback copy
      const textarea = document.createElement('textarea');
      textarea.value = formattedTelegramList;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedList(true);
      setTimeout(() => setCopiedList(false), 2500);
    }
  };

  const handleSendRosterToTelegram = async () => {
    if (isSendingTelegram || visibleEntries.length === 0) return;
    setIsSendingTelegram(true);
    setTelegramFeedback(null);

    try {
      const res = await sendTelegramRosterList(formattedTelegramList);
      if (res.ok) {
        setTelegramFeedback({
          type: 'success',
          message:
            lang === 'ko'
              ? '텔레그램 보안 소주제방(seguridad · 23703)에 당번 명단을 전송했습니다!'
              : '¡Lista de guardia enviada al grupo de Telegram (seguridad · 23703)!',
        });
      } else {
        setTelegramFeedback({
          type: 'error',
          message:
            lang === 'ko'
              ? `전송 실패: ${res.error}`
              : `Error al enviar: ${res.error}`,
        });
      }
    } catch (err: any) {
      setTelegramFeedback({
        type: 'error',
        message: err?.message || 'Error',
      });
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const headerDateRangeText = formatRosterHeaderDateRange(rangeStart, rangeEnd);

  const monthNamesKo = [
    '1월',
    '2월',
    '3월',
    '4월',
    '5월',
    '6월',
    '7월',
    '8월',
    '9월',
    '10월',
    '11월',
    '12월',
  ];
  const monthNamesEs = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
      {/* Header & Interactive Date Range Dropdown Trigger */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-700 shrink-0" />
            <h2 className="text-base font-bold text-slate-900">
              {lang === 'ko'
                ? 'Seguridad 보안 당번 명단'
                : 'Rol de Guardia de Seguridad'}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleResetDefault}
            className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
            title={lang === 'ko' ? '11/25~12/08 기본 명단 복원' : 'Restaurar 11/25~12/08'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{lang === 'ko' ? '기본 명단 복원' : 'Restaurar'}</span>
          </button>
        </div>

        {/* Date Range Dropdown Button (Opens Visual Start ~ End Calendar) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsRangeCalendarOpen(!isRangeCalendarOpen);
              setSelectionStep('start');
            }}
            className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
              isRangeCalendarOpen
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100/80 text-slate-900 border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Calendar
                className={`w-4 h-4 shrink-0 ${
                  isRangeCalendarOpen ? 'text-blue-300' : 'text-blue-700'
                }`}
              />
              <div className="truncate">
                <span className="text-[11px] font-medium opacity-75 block">
                  {lang === 'ko'
                    ? '표시 및 텔레그램 추출 기간 (클릭하여 시작일 ~ 종료일 선택)'
                    : 'Periodo de la lista (Clic para elegir fecha inicio ~ fin)'}
                </span>
                <span className="text-xs sm:text-sm font-mono-tabular font-extrabold">
                  {headerDateRangeText} ({visibleEntries.length}
                  {lang === 'ko' ? '일' : ' días'})
                </span>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 shrink-0 transition-transform ${
                isRangeCalendarOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Interactive Start ~ End Date Range Calendar Popover */}
          {isRangeCalendarOpen && (
            <div className="mt-2 p-4 rounded-2xl bg-white border border-slate-300 shadow-xl space-y-3 z-20 relative">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-blue-700">
                  {selectionStep === 'start'
                    ? lang === 'ko'
                      ? '① 시작 날짜를 캘린더에서 클릭하세요'
                      : '① Haga clic en la fecha de INICIO'
                    : lang === 'ko'
                    ? `② 끝 날짜를 클릭하세요 (시작: ${rangeStart})`
                    : `② Haga clic en la fecha FINAL (Inicio: ${rangeStart})`}
                </span>
                <button
                  type="button"
                  onClick={() => setIsRangeCalendarOpen(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {lang === 'ko' ? '닫기' : 'Cerrar'}
                </button>
              </div>

              {/* Month Navigation Header */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => navigateCalendarMonth(-1)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-sm font-bold text-slate-900 font-mono-tabular">
                  {calYear}.{' '}
                  {lang === 'ko'
                    ? monthNamesKo[calMonth]
                    : monthNamesEs[calMonth]}
                </div>
                <button
                  type="button"
                  onClick={() => navigateCalendarMonth(1)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-500">
                {t.daysShort.map((d, i) => (
                  <div
                    key={d}
                    className={
                      i === 0
                        ? 'text-rose-600'
                        : i === 6
                        ? 'text-blue-600'
                        : ''
                    }
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar Days Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell) => {
                  const previewEnd =
                    selectionStep === 'end' && hoverDate
                      ? hoverDate
                      : rangeEnd;
                  const effStart =
                    rangeStart <= previewEnd ? rangeStart : previewEnd;
                  const effEnd =
                    rangeStart <= previewEnd ? previewEnd : rangeStart;

                  const isStart = cell.dateStr === effStart;
                  const isEnd = cell.dateStr === effEnd;
                  const isInRange =
                    cell.dateStr >= effStart && cell.dateStr <= effEnd;

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onMouseEnter={() => setHoverDate(cell.dateStr)}
                      onMouseLeave={() => setHoverDate(null)}
                      onClick={() => handleCalendarDayClick(cell.dateStr)}
                      className={`h-9 rounded-lg text-xs font-mono-tabular font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                        isStart || isEnd
                          ? 'bg-blue-700 text-white font-extrabold shadow-2xs'
                          : isInRange
                          ? 'bg-blue-100 text-blue-900'
                          : cell.inMonth
                          ? 'text-slate-800 hover:bg-slate-100'
                          : 'text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {cell.dayNum}
                    </button>
                  );
                })}
              </div>

              {/* Direct Date Inputs Fallback inside Calendar Popover */}
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block">
                    {lang === 'ko' ? '시작 날짜' : 'Fecha Inicio'}
                  </label>
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      setRangeStart(val);
                      if (val > rangeEnd) setRangeEnd(val);
                      const expanded = ensureDateRangeInRoster(
                        roster,
                        val,
                        val > rangeEnd ? val : rangeEnd
                      );
                      onUpdateRoster(expanded);
                    }}
                    className="w-full h-8 px-2 rounded border border-slate-200 font-mono-tabular text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block">
                    {lang === 'ko' ? '끝 날짜' : 'Fecha Fin'}
                  </label>
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      setRangeEnd(val);
                      if (val < rangeStart) setRangeStart(val);
                      const expanded = ensureDateRangeInRoster(
                        roster,
                        val < rangeStart ? val : rangeStart,
                        val
                      );
                      onUpdateRoster(expanded);
                    }}
                    className="w-full h-8 px-2 rounded border border-slate-200 font-mono-tabular text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Auto-Cascade Alphabetical Toggle Bar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
          <span className="text-slate-600 font-medium">
            {lang === 'ko'
              ? '드롭다운으로 담당자 변경 시:'
              : 'Al cambiar encargado:'}
          </span>
          <button
            type="button"
            onClick={() => setAutoCascadeAlphabetical(!autoCascadeAlphabetical)}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              autoCascadeAlphabetical
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {autoCascadeAlphabetical ? (
              <>
                <Link2 className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ko'
                    ? '이후 날짜 알파벳순 자동 재정렬 ON'
                    : 'Auto-ordenar siguientes A-Z: ON'}
                </span>
              </>
            ) : (
              <>
                <Unlink2 className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ko'
                    ? '선택한 날짜만 개별 변경'
                    : 'Cambiar solo fila individual'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Top Direction Button: Prepend Previous Day (-1 Day & Previous Alphabetical Inspector) */}
      <button
        type="button"
        onClick={handleAddPrevDaySequential}
        className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-xs font-semibold text-slate-700 hover:text-blue-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
      >
        <ChevronUp className="w-4 h-4 text-blue-600" />
        <span>
          {lang === 'ko'
            ? `위쪽으로 이전 날짜 추가 (${
                firstVisible
                  ? `${shiftDateString(firstVisible.dateStr, -1).slice(5).replace('-', '/')} · ${shiftInspectorAlphabetical(firstVisible.inspector, -1)}`
                  : '이전 날'
              })`
            : `Agregar día anterior arriba (${
                firstVisible
                  ? `${shiftDateString(firstVisible.dateStr, -1).slice(5).replace('-', '/')} · ${shiftInspectorAlphabetical(firstVisible.inspector, -1)}`
                  : 'Día anterior'
              })`}
        </span>
      </button>

      {/* Roster Rows List (Filtered by rangeStart ~ rangeEnd) */}
      <div
        ref={scrollContainerRef}
        className="divide-y divide-slate-100 border-t border-b border-slate-200 max-h-[380px] overflow-y-auto rounded-lg"
      >
        {visibleEntries.map((entry) => {
          const isToday = entry.dateStr === todayDateStr;
          const koDay = TRANSLATIONS.ko.daysShort[entry.dayOfWeekIdx];
          const esDay = TRANSLATIONS.es.daysShort[entry.dayOfWeekIdx];
          const isCurrentlySelected = selectedInspector === entry.inspector;

          return (
            <div
              key={entry.dateStr}
              className={`py-2.5 px-2.5 sm:px-3 flex items-center justify-between gap-2 transition-colors ${
                isToday ? 'bg-blue-50/90' : 'hover:bg-slate-50'
              }`}
            >
              {/* Left: Bullet Format Preview (`• 11/25 (수 / Mié):`) */}
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectInspector(entry.inspector)}
                  className={`px-2 py-1 rounded-md text-xs font-mono-tabular font-bold flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                    isToday
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  {entry.shortDate}
                </button>

                <div className="text-xs truncate">
                  <span className="font-semibold text-slate-800">
                    ({koDay} / {esDay})
                  </span>
                  {isToday && (
                    <span className="ml-1.5 text-[11px] font-bold text-blue-700">
                      · {lang === 'ko' ? '오늘 당번 (Hoy)' : 'Hoy'}
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Direct Inspector Dropdown on Every Row + Delete Row */}
              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  aria-label={`${entry.shortDate} inspector`}
                  value={entry.inspector}
                  onChange={(e) =>
                    handleRowInspectorChange(
                      entry.dateStr,
                      e.target.value as InspectorName
                    )
                  }
                  className={`h-8 px-2.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                    isToday
                      ? 'bg-blue-700 text-white border-blue-700'
                      : isCurrentlySelected
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  {INSPECTORS.map((person) => (
                    <option
                      key={person}
                      value={person}
                      className="bg-white text-slate-900 font-semibold"
                    >
                      {person}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => handleRemoveRow(entry.dateStr)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title={lang === 'ko' ? '이 날짜 행 삭제' : 'Eliminar fila'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Bidirectional & Calendar Auto-Sequential Addition Section */}
      <div className="rounded-xl bg-slate-50 border border-slate-200/90 p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={handleAddNextDaySequential}
            className="flex-1 min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>
              {lang === 'ko'
                ? `다음 날짜 이어서 추가 (${
                    lastVisible
                      ? `${shiftDateString(lastVisible.dateStr, 1).slice(5).replace('-', '/')} · ${shiftInspectorAlphabetical(lastVisible.inspector, 1)}`
                      : '다음 날'
                  })`
                : `Agregar siguiente fecha (${
                    lastVisible
                      ? `${shiftDateString(lastVisible.dateStr, 1).slice(5).replace('-', '/')} · ${shiftInspectorAlphabetical(lastVisible.inspector, 1)}`
                      : 'Siguiente'
                  })`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              syncSeedPicker(roster, rangeEnd);
              setShowStartPicker(!showStartPicker);
            }}
            className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              showStartPicker
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {lang === 'ko' ? '특정 날짜 개별 추가' : 'Agregar fecha'}
            </span>
          </button>
        </div>

        {showStartPicker && (
          <div className="p-3 rounded-xl bg-white border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <div className="sm:col-span-5">
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                {lang === 'ko' ? '추가할 날짜' : 'Fecha'}
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono-tabular font-bold"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                {lang === 'ko' ? '담당자 (A-Z)' : 'Encargado'}
              </label>
              <select
                value={customStartInspector}
                onChange={(e) =>
                  setCustomStartInspector(e.target.value as InspectorName)
                }
                className="w-full h-9 px-2 rounded-lg border border-slate-300 text-xs font-bold"
              >
                {INSPECTORS.map((person, i) => (
                  <option key={person} value={person}>
                    {i + 1}. {person}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3 sm:pt-4">
              <button
                type="button"
                onClick={handleAddFromCalendarSeed}
                className="w-full h-9 px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ko' ? '연속 추가' : 'Agregar'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Telegram Formatted Roster Extraction Preview + 1-Click Copy & Direct Send to Topic 23703 */}
      <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-blue-300">
            {lang === 'ko'
              ? '📋 텔레그램 전송용 당번 명단 추출 (복사 및 소주제방 즉시 전송)'
              : '📋 Lista formateada para Telegram (Copiar o Enviar al grupo)'}
          </span>
          <span className="text-[11px] font-mono-tabular text-slate-400">
            seguridad · #23703
          </span>
        </div>

        {/* Exact Formatted Text Box */}
        <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-sans leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto select-all">
          {formattedTelegramList}
        </pre>

        {/* Feedback Alert */}
        {telegramFeedback && (
          <div
            className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              telegramFeedback.type === 'success'
                ? 'bg-emerald-950/90 border border-emerald-700 text-emerald-200'
                : 'bg-rose-950/90 border border-rose-700 text-rose-200'
            }`}
          >
            {telegramFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{telegramFeedback.message}</span>
          </div>
        )}

        {/* Action Buttons: 1) Copy Formatted List 2) Send List to Telegram Topic 23703 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleCopyRosterList}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer"
          >
            {copiedList ? (
              <>
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-emerald-300">
                  {lang === 'ko'
                    ? '명단 복사 완료! (텔레그램에 붙여넣기)'
                    : '¡Lista copiada al portapapeles!'}
                </span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 shrink-0" />
                <span>
                  {lang === 'ko'
                    ? '정리된 명단 복사하기'
                    : 'Copiar Lista Formateada'}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSendRosterToTelegram}
            disabled={isSendingTelegram || visibleEntries.length === 0}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Send className="w-4 h-4 shrink-0" />
            <span>
              {isSendingTelegram
                ? lang === 'ko'
                  ? '텔레그램 소주제방 전송 중...'
                  : 'Enviando a Telegram...'
                : lang === 'ko'
                ? '텔레그램 소주제방(seguridad)에 명단 전송'
                : 'Enviar Lista al Grupo Telegram'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
