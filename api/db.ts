import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.resolve(__dirname, '..', 'data')
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const DB_PATH = path.join(DATA_DIR, 'hospital.db')

const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hospitalization (
      id TEXT PRIMARY KEY,
      pet_name TEXT NOT NULL,
      pet_type TEXT NOT NULL,
      breed TEXT DEFAULT '',
      age INTEGER DEFAULT 0,
      weight REAL DEFAULT 0,
      owner_name TEXT NOT NULL,
      owner_phone TEXT NOT NULL,
      vaccine_status TEXT NOT NULL DEFAULT 'unknown',
      isolation_required INTEGER NOT NULL DEFAULT 0,
      deposit_amount REAL NOT NULL DEFAULT 0,
      deposit_used REAL NOT NULL DEFAULT 0,
      auth_surgery INTEGER NOT NULL DEFAULT 0,
      auth_transfusion INTEGER NOT NULL DEFAULT 0,
      auth_special_exam INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'admitted',
      admitting_vet_id TEXT DEFAULT '',
      admitting_nurse_id TEXT DEFAULT '',
      cage_number TEXT DEFAULT '',
      admission_date TEXT NOT NULL,
      discharge_date TEXT,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      hospitalization_id TEXT NOT NULL,
      vet_id TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'medication',
      content TEXT NOT NULL,
      dosage TEXT DEFAULT '',
      frequency TEXT DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT,
      confirmed INTEGER NOT NULL DEFAULT 0,
      confirmed_by TEXT,
      confirmed_at TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      change_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (hospitalization_id) REFERENCES hospitalization(id)
    );

    CREATE TABLE IF NOT EXISTS nursing_record (
      id TEXT PRIMARY KEY,
      hospitalization_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      nurse_id TEXT NOT NULL,
      executed_at TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT 'normal',
      observation TEXT DEFAULT '',
      abnormal_note TEXT,
      handover_note TEXT,
      shift_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (hospitalization_id) REFERENCES hospitalization(id),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (shift_id) REFERENCES shift(id)
    );

    CREATE TABLE IF NOT EXISTS billing_item (
      id TEXT PRIMARY KEY,
      hospitalization_id TEXT NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      total_amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (hospitalization_id) REFERENCES hospitalization(id)
    );

    CREATE TABLE IF NOT EXISTS shift (
      id TEXT PRIMARY KEY,
      nurse_on_duty TEXT NOT NULL,
      nurse_off_duty TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      handover_notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const count = db.prepare('SELECT COUNT(*) as cnt FROM staff').get() as { cnt: number }
  let nurseId = ''
  if (count.cnt === 0) {
    const insert = db.prepare(
      'INSERT INTO staff (id, name, role, code) VALUES (?, ?, ?, ?)'
    )
    const seed = [
      [crypto.randomUUID(), '张医生', 'vet', 'V001'],
      [crypto.randomUUID(), '李护士', 'nurse', 'N001'],
      [crypto.randomUUID(), '王前台', 'receptionist', 'R001'],
      [crypto.randomUUID(), '赵药师', 'pharmacist', 'P001'],
      [crypto.randomUUID(), '钱结算', 'billing', 'B001'],
    ] as const
    for (const [id, name, role, code] of seed) {
      insert.run(id, name, role, code)
      if (role === 'nurse') nurseId = id
    }
  } else {
    const nurse = db.prepare("SELECT id FROM staff WHERE role = 'nurse' LIMIT 1").get() as { id: string } | undefined
    if (nurse) nurseId = nurse.id
  }

  const shiftCount = db.prepare("SELECT COUNT(*) as cnt FROM shift WHERE status = 'active'").get() as { cnt: number }
  if (shiftCount.cnt === 0 && nurseId) {
    db.prepare(
      'INSERT INTO shift (id, nurse_on_duty, start_time, status, handover_notes) VALUES (?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      nurseId,
      new Date().toISOString(),
      'active',
      ''
    )
  }
}

export default db
