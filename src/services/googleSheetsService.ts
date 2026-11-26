import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { InspectionLogEntry } from '../i18n';

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

/**
 * Extracts a clean Google Spreadsheet ID from either a full URL or raw ID string.
 */
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Upload a base64 photo to the user's Google Drive (`drive.file` scope) and make it viewable
 * so Google Sheets `=IMAGE("https://drive.google.com/uc?export=view&id=...")` renders the actual photo inside the cell.
 */
async function uploadPhotoToDriveForSheet(
  accessToken: string,
  dataUrl: string,
  fileName: string
): Promise<string | null> {
  try {
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) return null;

    const metadata = {
      name: fileName,
      mimeType: 'image/jpeg',
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: image/jpeg\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      base64Data +
      closeDelimiter;

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!uploadRes.ok) return null;
    const fileData = await uploadRes.json();
    const fileId = fileData.id;
    if (!fileId) return null;

    // Grant anyone with link reader permission so Google Sheets =IMAGE() can render it
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });

    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  } catch (e) {
    console.warn('Failed to upload image to Drive for Sheet formula:', e);
    return null;
  }
}

/**
 * Creates a brand-new Google Spreadsheet pre-formatted with header columns for Temple Security Inspection.
 */
export async function createSecuritySpreadsheet(
  accessToken: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: '성전 보안 점검 누적 대장 (Registro de Seguridad del Templo)',
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create spreadsheet: ${errText}`);
  }

  const data = await createRes.json();
  const spreadsheetId = data.spreadsheetId;
  const firstSheetName = data.sheets?.[0]?.properties?.title || 'Sheet1';

  // Populate header row
  const headers = [
    [
      '날짜 (Fecha)',
      '시간 (Hora)',
      '요일 (Día)',
      '담당자 (Encargado)',
      '1. 대문 (Puerta Principal)',
      '2. 현관문 (Puerta de Entrada)',
      '3. 식당 철문 (Puerta del Comedor)',
      '4. 모든 불 소등 확인 (Luces Apagadas)',
      '특이사항 메모 (Notas)',
      '대문 사진 링크',
      '현관문 사진 링크',
      '식당 철문 사진 링크',
    ],
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      firstSheetName
    )}!A1:L1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: headers }),
    }
  );

  return {
    spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

/**
 * Appends an inspection log entry to either:
 * 1) Connected Google Spreadsheet via Google Sheets API (with Drive image upload for =IMAGE() formulas), OR
 * 2) Configured Google Apps Script Webhook URL (zero-login mode for GitHub Pages volunteers).
 */
export async function appendInspectionToGoogleSheets(
  entry: InspectionLogEntry,
  options: {
    spreadsheetId?: string;
    webhookUrl?: string;
  }
): Promise<{ synced: boolean; mode?: 'oauth' | 'webhook'; error?: string }> {
  const token = await getAccessToken();
  const cleanSheetId = options.spreadsheetId ? extractSpreadsheetId(options.spreadsheetId) : '';

  // Path A: Direct Google Sheets API via OAuth token
  if (token && cleanSheetId) {
    try {
      // Fetch metadata first to avoid hardcoding "Sheet1"
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanSheetId}?fields=sheets.properties.title`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!metaRes.ok) {
        throw new Error('Could not access the specified Google Spreadsheet.');
      }

      const metaData = await metaRes.json();
      const sheetTitle = metaData.sheets?.[0]?.properties?.title || 'Sheet1';

      // Upload the 3 photos to Drive so =IMAGE() renders inside the spreadsheet cells
      const prefix = `${entry.dateStr}_${entry.inspector}`;
      const [url1, url2, url3] = await Promise.all([
        uploadPhotoToDriveForSheet(token, entry.photos.mainGate, `${prefix}_1_MainGate.jpg`),
        uploadPhotoToDriveForSheet(token, entry.photos.frontDoor, `${prefix}_2_FrontDoor.jpg`),
        uploadPhotoToDriveForSheet(token, entry.photos.diningIronDoor, `${prefix}_3_DiningIronDoor.jpg`),
      ]);

      const cellPhoto1 = url1 ? `=IMAGE("${url1}")` : '촬영 완료 (Foto 1 OK)';
      const cellPhoto2 = url2 ? `=IMAGE("${url2}")` : '촬영 완료 (Foto 2 OK)';
      const cellPhoto3 = url3 ? `=IMAGE("${url3}")` : '촬영 완료 (Foto 3 OK)';

      const rowValues = [
        [
          entry.dateStr,
          entry.timeStr,
          `${entry.dayOfWeekKo} (${entry.dayOfWeekEs})`,
          entry.inspector,
          cellPhoto1,
          cellPhoto2,
          cellPhoto3,
          entry.lightsOffConfirmed ? '네 / Sí (확인 완료)' : '아니오',
          entry.notes || '-',
          url1 || 'Local Storage',
          url2 || 'Local Storage',
          url3 || 'Local Storage',
        ],
      ];

      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanSheetId}/values/${encodeURIComponent(
          sheetTitle
        )}!A:L:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: rowValues }),
        }
      );

      if (!appendRes.ok) {
        const errText = await appendRes.text();
        throw new Error(errText);
      }

      return { synced: true, mode: 'oauth' };
    } catch (err: any) {
      console.error('OAuth Sheets append error:', err);
      // Fall through to webhook if configured
      if (!options.webhookUrl) {
        return { synced: false, error: err?.message || 'Google Sheets API sync failed' };
      }
    }
  }

  // Path B: Google Apps Script Webhook URL (Zero-Login GitHub Pages compatible)
  if (options.webhookUrl && options.webhookUrl.trim().startsWith('https://script.google.com')) {
    try {
      await fetch(options.webhookUrl.trim(), {
        method: 'POST',
        mode: 'no-cors', // Apps Script web apps accept POST with no-cors from static GitHub Pages
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          date: entry.dateStr,
          time: entry.timeStr,
          dayOfWeek: `${entry.dayOfWeekKo} (${entry.dayOfWeekEs})`,
          inspector: entry.inspector,
          photoMainGate: entry.photos.mainGate,
          photoFrontDoor: entry.photos.frontDoor,
          photoDiningIronDoor: entry.photos.diningIronDoor,
          lightsOffConfirmed: '네 / Sí',
          notes: entry.notes || '',
        }),
      });
      return { synced: true, mode: 'webhook' };
    } catch (err: any) {
      return { synced: false, error: err?.message || 'Webhook request failed' };
    }
  }

  return { synced: false };
}

export const APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "날짜 (Fecha)", "시간 (Hora)", "요일 (Día)", "담당자 (Encargado)",
      "1. 대문 사진", "2. 현관문 사진", "3. 식당 철문 사진",
      "4. 소등 확인 (Luces)", "특이사항 (Notas)"
    ]);
  }
  
  // Google Drive에 사진 3장 자동 저장 후 시트에 =IMAGE() 수식으로 삽입
  var folderName = "Temple_Security_Photos";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  
  function savePhoto(dataUrl, label) {
    if (!dataUrl || dataUrl.indexOf("base64,") === -1) return "";
    var bytes = Utilities.base64Decode(dataUrl.split("base64,")[1]);
    var blob = Utilities.newBlob(bytes, "image/jpeg", data.date + "_" + data.inspector + "_" + label + ".jpg");
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return '=IMAGE("https://drive.google.com/uc?export=view&id=' + file.getId() + '")';
  }
  
  var img1 = savePhoto(data.photoMainGate, "1_MainGate");
  var img2 = savePhoto(data.photoFrontDoor, "2_FrontDoor");
  var img3 = savePhoto(data.photoDiningIronDoor, "3_DiningDoor");
  
  sheet.appendRow([
    data.date, data.time, data.dayOfWeek, data.inspector,
    img1, img2, img3, data.lightsOffConfirmed, data.notes
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
