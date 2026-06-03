import { Capacitor } from '@capacitor/core'
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth'
import { exportDatabaseToSQL } from '@/shared/db/app_db'

const BACKUP_FILE_NAME = 'dashbord-backup.sql'
const LAST_BACKUP_KEY  = 'drive_last_backup_date'
const ENABLED_KEY      = 'drive_backup_enabled'

export function getDriveBackupEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === '1'
}
export function setDriveBackupEnabled(v: boolean): void {
  localStorage.setItem(ENABLED_KEY, v ? '1' : '0')
}
export function getLastBackupDate(): string | null {
  return localStorage.getItem(LAST_BACKUP_KEY)
}

async function getAccessToken(): Promise<string> {
  const user = await GoogleAuth.signIn()
  const token = (user as any)?.authentication?.accessToken
  if (!token) throw new Error('Google sign-in failed — no access token returned')
  return token
}

async function findBackupFileId(token: string): Promise<string | null> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name%3D'${BACKUP_FILE_NAME}'%20and%20trashed%3Dfalse&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  return data?.files?.[0]?.id ?? null
}

async function uploadToDrive(token: string, sql: string, fileId: string | null): Promise<void> {
  const metadata = { name: BACKUP_FILE_NAME, mimeType: 'text/plain' }
  const boundary = '-------314159265358979323846'
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: text/plain',
    '',
    sql,
    `--${boundary}--`,
  ].join('\r\n')

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'

  const res = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body,
  })
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status} ${await res.text()}`)
}

export async function runBackupNow(): Promise<void> {
  if (!Capacitor.isNativePlatform()) throw new Error('Drive backup only works on Android')
  const result = await exportDatabaseToSQL()
  if (!result?.sql) throw new Error('Database export failed')
  const sql = result.sql
  const token = await getAccessToken()
  const fileId = await findBackupFileId(token)
  await uploadToDrive(token, sql, fileId)
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString().slice(0, 10))
}

export async function runDailyBackupIfNeeded(): Promise<void> {
  if (!getDriveBackupEnabled()) return
  if (!Capacitor.isNativePlatform()) return
  const today = new Date().toISOString().slice(0, 10)
  if (getLastBackupDate() === today) return
  try {
    await runBackupNow()
  } catch {
    // Silent fail on background auto-backup — user can manually retry in Settings
  }
}
