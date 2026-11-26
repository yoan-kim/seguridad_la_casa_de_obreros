import React, { useState } from 'react';
import { Calendar, Edit3, Check } from 'lucide-react';
import {
  DayOfWeekIndex,
  INSPECTORS,
  InspectorName,
  Language,
  TRANSLATIONS,
  WeeklySchedule,
} from '../i18n';

interface WeeklyScheduleCardProps {
  lang: Language;
  schedule: WeeklySchedule;
  todayIndex: DayOfWeekIndex;
  selectedInspector: InspectorName;
  onSelectInspector: (inspector: InspectorName) => void;
  onUpdateSchedule: (newSchedule: WeeklySchedule) => void;
}

const ORDERED_DAYS: DayOfWeekIndex[] = [1, 2, 3, 4, 5, 6, 0]; // Mon -> Sun

export const WeeklyScheduleCard: React.FC<WeeklyScheduleCardProps> = ({
  lang,
  schedule,
  todayIndex,
  selectedInspector,
  onSelectInspector,
  onUpdateSchedule,
}) => {
  const t = TRANSLATIONS[lang];
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<WeeklySchedule>(schedule);

  const handleSave = () => {
    onUpdateSchedule(draft);
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-700 shrink-0" />
            <h2 className="text-base font-bold text-slate-900">{t.scheduleCardTitle}</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">{t.scheduleCardDesc}</p>
        </div>

        {!isEditing ? (
          <button
            type="button"
            onClick={() => {
              setDraft(schedule);
              setIsEditing(true);
            }}
            className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{t.editScheduleBtn}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t.saveScheduleBtn}</span>
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
        {ORDERED_DAYS.map((dayIdx) => {
          const isToday = dayIdx === todayIndex;
          const assigned = isEditing ? draft[dayIdx] : schedule[dayIdx];
          const isCurrentlySelected = selectedInspector === assigned;

          return (
            <div
              key={dayIdx}
              className={`py-2.5 px-3 flex items-center justify-between gap-3 transition-colors ${
                isToday ? 'bg-blue-50/70' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center ${
                    isToday
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {t.daysShort[dayIdx]}
                </span>
                <div>
                  <span className="text-xs font-semibold text-slate-900">
                    {t.days[dayIdx]}
                  </span>
                  {isToday && (
                    <span className="ml-2 text-[11px] font-semibold text-blue-700">
                      · {lang === 'ko' ? '오늘 (Hoy)' : 'Hoy (오늘)'}
                    </span>
                  )}
                </div>
              </div>

              {isEditing ? (
                <select
                  value={draft[dayIdx]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [dayIdx]: e.target.value as InspectorName,
                    })
                  }
                  className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                  onClick={() => onSelectInspector(assigned)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isCurrentlySelected
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  {assigned}
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
