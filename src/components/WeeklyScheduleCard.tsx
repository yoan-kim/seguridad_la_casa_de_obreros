import React, { useState } from 'react';
import { Calendar, Edit3, Check, RotateCcw } from 'lucide-react';
import {
  DateRosterEntry,
  DayOfWeekIndex,
  INSPECTORS,
  InspectorName,
  Language,
  OFFICIAL_DATE_ROSTER,
  TRANSLATIONS,
} from '../i18n';

interface WeeklyScheduleCardProps {
  lang: Language;
  todayDateStr: string;
  todayIndex: DayOfWeekIndex;
  roster: DateRosterEntry[];
  selectedInspector: InspectorName;
  onSelectInspector: (inspector: InspectorName) => void;
  onUpdateRoster: (newRoster: DateRosterEntry[]) => void;
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
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<DateRosterEntry[]>(roster);

  const handleSave = () => {
    onUpdateRoster(draft);
    setIsEditing(false);
  };

  const handleResetDefault = () => {
    setDraft(OFFICIAL_DATE_ROSTER);
    onUpdateRoster(OFFICIAL_DATE_ROSTER);
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-700 shrink-0" />
            <h2 className="text-base font-bold text-slate-900">
              {lang === 'ko'
                ? 'Seguridad 보안 당번 명단 (2026. 11. 25 ~ 12. 08)'
                : 'Rol de Guardia de Seguridad (2026. 11. 25 ~ 12. 08)'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'ko'
              ? '오늘 날짜의 보안 당번이 자동으로 선택되며, 이름을 누르거나 드롭다운으로 변경할 수 있습니다.'
              : 'El encargado de la fecha actual se selecciona automáticamente. Puede pulsar un nombre para cambiarlo.'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => {
                setDraft(roster);
                setIsEditing(true);
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{t.editScheduleBtn}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleResetDefault}
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 flex items-center gap-1 shrink-0 cursor-pointer"
                title={lang === 'ko' ? '기본 명단 복원' : 'Restaurar'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t.saveScheduleBtn}</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-100 border-t border-b border-slate-100 max-h-[420px] overflow-y-auto">
        {(isEditing ? draft : roster).map((entry, idx) => {
          const isToday = entry.dateStr === todayDateStr;
          const koDay = TRANSLATIONS.ko.daysShort[entry.dayOfWeekIdx];
          const esDay = TRANSLATIONS.es.daysShort[entry.dayOfWeekIdx];
          const isCurrentlySelected = selectedInspector === entry.inspector && isToday;

          return (
            <div
              key={entry.dateStr}
              className={`py-2.5 px-3 flex items-center justify-between gap-3 transition-colors ${
                isToday ? 'bg-blue-50/90' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`px-2 py-1 rounded-md text-xs font-mono-tabular font-bold flex items-center justify-center ${
                    isToday
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {entry.shortDate}
                </span>
                <div className="text-xs">
                  <span className="font-semibold text-slate-800">
                    ({koDay} / {esDay})
                  </span>
                  {isToday && (
                    <span className="ml-2 text-[11px] font-bold text-blue-700">
                      · {lang === 'ko' ? '오늘 당번 (Hoy)' : 'Turno de Hoy'}
                    </span>
                  )}
                </div>
              </div>

              {isEditing ? (
                <select
                  value={draft[idx].inspector}
                  onChange={(e) => {
                    const updated = [...draft];
                    updated[idx] = {
                      ...updated[idx],
                      inspector: e.target.value as InspectorName,
                    };
                    setDraft(updated);
                  }}
                  className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {INSPECTORS.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectInspector(entry.inspector)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    isCurrentlySelected
                      ? 'bg-blue-700 text-white'
                      : selectedInspector === entry.inspector
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-800 hover:bg-slate-200/70'
                  }`}
                >
                  {entry.inspector}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* All 8 members quick reference */}
      <div className="pt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">
          {lang === 'ko' ? '전체 보안 담당자 (8인):' : 'Equipo de Seguridad (8):'}
        </span>
        {INSPECTORS.map((name, idx) => (
          <React.Fragment key={name}>
            <button
              type="button"
              onClick={() => onSelectInspector(name)}
              className={`hover:text-slate-900 cursor-pointer ${
                selectedInspector === name ? 'font-bold text-blue-700 underline' : ''
              }`}
            >
              {name}
            </button>
            {idx < INSPECTORS.length - 1 && <span aria-hidden="true">·</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
