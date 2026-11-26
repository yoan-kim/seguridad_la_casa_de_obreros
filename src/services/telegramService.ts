import { InspectorName } from '../i18n';

// Default configuration requested by user:
// Target Link: https://t.me/c/2256338393/23703
// Supergroup Chat ID: -1002256338393
// Topic / Message Thread ID: 23703
// Esdras Bot Token: 9075967226:AAHtpoI7mCXmgDjmTGgX8fzYrP7Sz4LuNcg
export const DEFAULT_TELEGRAM_CONFIG = {
  botToken: '9075967226:AAHtpoI7mCXmgDjmTGgX8fzYrP7Sz4LuNcg',
  chatId: '-1002256338393',
  messageThreadId: 23703,
  topicUrl: 'https://t.me/c/2256338393/23703',
};

export interface TelegramReportPayload {
  inspector: InspectorName;
  dateStr: string;
  timeStr: string;
  dayOfWeekKo: string;
  dayOfWeekEs: string;
  notes?: string;
  sheetUrl?: string;
}

export function buildTelegramSummaryMessage(payload: TelegramReportPayload): string {
  const { inspector, dateStr, timeStr, dayOfWeekKo, dayOfWeekEs, notes, sheetUrl } = payload;

  const lines = [
    `🛡️ *성전 보안 점검 완료 보고 / Informe de Seguridad del Templo*`,
    ``,
    `👤 *담당자 (Encargado):* ${inspector}`,
    `📅 *일시 (Fecha):* ${dateStr} (${dayOfWeekKo} / ${dayOfWeekEs}) ${timeStr}`,
    `✅ *점검 항목:* 1. 대문 · 2. 현관문 · 3. 식당 철문 · 4. 전등 소등 확인(네/Sí)`,
    ``,
    `💬 *"${inspector} 담당자님께서 사진 세 곳(대문, 현관문, 식당 철문)을 촬영하여 올려주셨고, 성전 및 2층 계단 등 모든 불을 꺼주셨다고 합니다. 수고하셨습니다, 감사합니다!"*`,
    `💬 *"El encargado ${inspector} ha tomado y subido las fotografías de las tres puertas y confirmó que todas las luces están apagadas. ¡Muchas gracias por su esfuerzo!"*`,
  ];

  if (notes && notes.trim()) {
    lines.push(``, `📝 *특이사항 (Nota):* ${notes.trim()}`);
  }

  if (sheetUrl) {
    lines.push(``, `📊 [구글 스프레드시트 누적 기록 보기 (Ver Google Sheets)](${sheetUrl})`);
  }

  return lines.join('\n');
}

export async function sendTelegramSummaryReport(
  payload: TelegramReportPayload,
  customConfig = DEFAULT_TELEGRAM_CONFIG
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const text = buildTelegramSummaryMessage(payload);
  const endpoint = `https://api.telegram.org/bot${customConfig.botToken.trim()}/sendMessage`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: customConfig.chatId.trim(),
        message_thread_id: Number(customConfig.messageThreadId),
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (data && data.ok) {
      return { ok: true, messageId: data.result?.message_id };
    }

    // Fallback: if message_thread_id failed (e.g. if topic was closed or general chat), retry without parse_mode
    const retryResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: customConfig.chatId.trim(),
        message_thread_id: Number(customConfig.messageThreadId),
        text: text.replace(/\*/g, ''),
      }),
    });
    const retryData = await retryResponse.json();
    if (retryData && retryData.ok) {
      return { ok: true, messageId: retryData.result?.message_id };
    }

    return {
      ok: false,
      error: data?.description || 'Telegram API returned an error',
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Network error while contacting Telegram API',
    };
  }
}

/**
 * Formats a date range header like "2026. 11. 25 ~ 12. 08" (or "2026. 12. 28 ~ 2027. 01. 05" if year changes)
 */
export function formatRosterHeaderDateRange(startDateStr: string, endDateStr: string): string {
  const [sy, sm, sd] = startDateStr.split('-');
  const [ey, em, ed] = endDateStr.split('-');
  if (!sy || !sm || !sd) return '';
  if (!ey || !em || !ed) return `${sy}. ${sm}. ${sd}`;

  if (sy === ey) {
    return `${sy}. ${sm}. ${sd} ~ ${em}. ${ed}`;
  }
  return `${sy}. ${sm}. ${sd} ~ ${ey}. ${em}. ${ed}`;
}

/**
 * Formats the filtered roster entries into the exact Telegram list text requested by the user:
 *
 * 🔐 [Seguridad 보안 당번 명단 | 2026. 11. 25 ~ 12. 08]
 *
 * • 11/25 (수 / Mié): Miguel
 * • 11/26 (목 / Jue): Daniel
 * ...
 */
export function buildTelegramRosterListText(
  entries: import('../i18n').DateRosterEntry[],
  koDaysShort: readonly string[],
  esDaysShort: readonly string[]
): string {
  if (entries.length === 0) {
    return '🔐 [Seguridad 보안 당번 명단]';
  }

  const first = entries[0];
  const last = entries[entries.length - 1];
  const rangeStr = formatRosterHeaderDateRange(first.dateStr, last.dateStr);

  const header = `🔐 [Seguridad 보안 당번 명단 | ${rangeStr}]`;
  const bullets = entries.map((entry) => {
    const koDay = koDaysShort[entry.dayOfWeekIdx];
    const esDay = esDaysShort[entry.dayOfWeekIdx];
    return `• ${entry.shortDate} (${koDay} / ${esDay}): ${entry.inspector}`;
  });

  return `${header}\n\n${bullets.join('\n')}`;
}

/**
 * Sends the formatted roster list directly to the Telegram seguridad topic (23703) via the Esdras bot.
 */
export async function sendTelegramRosterList(
  rosterText: string,
  customConfig = DEFAULT_TELEGRAM_CONFIG
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const endpoint = `https://api.telegram.org/bot${customConfig.botToken.trim()}/sendMessage`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: customConfig.chatId.trim(),
        message_thread_id: Number(customConfig.messageThreadId),
        text: rosterText,
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();
    if (data && data.ok) {
      return { ok: true, messageId: data.result?.message_id };
    }

    return {
      ok: false,
      error: data?.description || 'Telegram API returned an error',
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Network error while contacting Telegram API',
    };
  }
}

