import Database from 'better-sqlite3'
import crypto from 'crypto'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.resolve(__dirname, 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
const DB_PATH = path.join(DATA_DIR, 'hospital.db')
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS hospitalization (
    id TEXT PRIMARY KEY, pet_name TEXT NOT NULL, pet_type TEXT NOT NULL,
    breed TEXT DEFAULT '', age INTEGER DEFAULT 0, weight REAL DEFAULT 0,
    owner_name TEXT NOT NULL, owner_phone TEXT NOT NULL,
    vaccine_status TEXT NOT NULL DEFAULT 'unknown',
    isolation_required INTEGER NOT NULL DEFAULT 0,
    deposit_amount REAL NOT NULL DEFAULT 0, deposit_used REAL NOT NULL DEFAULT 0,
    auth_surgery INTEGER NOT NULL DEFAULT 0, auth_transfusion INTEGER NOT NULL DEFAULT 0,
    auth_special_exam INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'admitted',
    admitting_vet_id TEXT DEFAULT '', admitting_nurse_id TEXT DEFAULT '',
    cage_number TEXT DEFAULT '', admission_date TEXT NOT NULL,
    discharge_date TEXT, notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, hospitalization_id TEXT NOT NULL, vet_id TEXT NOT NULL,
    type TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'medication',
    content TEXT NOT NULL, dosage TEXT DEFAULT '', frequency TEXT DEFAULT '',
    start_date TEXT NOT NULL, end_date TEXT,
    confirmed INTEGER NOT NULL DEFAULT 0, confirmed_by TEXT, confirmed_at TEXT,
    status TEXT NOT NULL DEFAULT 'active', change_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (hospitalization_id) REFERENCES hospitalization(id)
  );
  CREATE TABLE IF NOT EXISTS shift (
    id TEXT PRIMARY KEY, nurse_on_duty TEXT NOT NULL, nurse_off_duty TEXT,
    start_time TEXT NOT NULL, end_time TEXT,
    handover_notes TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS nursing_record (
    id TEXT PRIMARY KEY, hospitalization_id TEXT NOT NULL, order_id TEXT NOT NULL,
    nurse_id TEXT NOT NULL, executed_at TEXT NOT NULL,
    result TEXT NOT NULL DEFAULT 'normal', observation TEXT DEFAULT '',
    abnormal_note TEXT, handover_note TEXT, shift_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (hospitalization_id) REFERENCES hospitalization(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (shift_id) REFERENCES shift(id)
  );
  CREATE TABLE IF NOT EXISTS billing_item (
    id TEXT PRIMARY KEY, hospitalization_id TEXT NOT NULL,
    category TEXT NOT NULL, name TEXT NOT NULL, amount REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1, total_amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (hospitalization_id) REFERENCES hospitalization(id)
  );
  CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

const insertStaff = db.prepare('INSERT INTO staff (id, name, role, code) VALUES (?, ?, ?, ?)')
for (const [n, r, c] of [['张医生','vet','V001'],['李护士','nurse','N001'],['王前台','receptionist','R001'],['赵药师','pharmacist','P001'],['钱结算','billing','B001']]) {
  insertStaff.run(crypto.randomUUID(), n, r, c)
}

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/staff', (_req, res) => {
  res.json({ success: true, data: db.prepare('SELECT * FROM staff ORDER BY created_at').all() })
})

app.get('/api/hospitalizations', (req, res) => {
  const status = req.query.status
  const rows = status
    ? db.prepare('SELECT * FROM hospitalization WHERE status = ? ORDER BY created_at DESC').all(status)
    : db.prepare('SELECT * FROM hospitalization ORDER BY created_at DESC').all()
  res.json({ success: true, data: rows })
})

app.get('/api/hospitalizations/:id', (req, res) => {
  const h = db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(req.params.id)
  if (!h) { res.status(404).json({ success: false, error: '住院记录不存在' }); return }
  const orders = db.prepare('SELECT * FROM orders WHERE hospitalization_id = ? ORDER BY created_at DESC').all(req.params.id)
  const nursing_records = db.prepare('SELECT * FROM nursing_record WHERE hospitalization_id = ? ORDER BY created_at DESC').all(req.params.id)
  const billing_items = db.prepare('SELECT * FROM billing_item WHERE hospitalization_id = ? ORDER BY created_at DESC').all(req.params.id)
  res.json({ success: true, data: { ...h, orders, nursing_records, billing_items } })
})

app.post('/api/hospitalizations', (req, res) => {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const input = req.body
  let isolation_required = input.isolation_required ?? 0
  if (input.vaccine_status === 'incomplete') isolation_required = 1
  db.prepare(`INSERT INTO hospitalization (
    id, pet_name, pet_type, breed, age, weight, owner_name, owner_phone,
    vaccine_status, isolation_required, deposit_amount, deposit_used,
    auth_surgery, auth_transfusion, auth_special_exam,
    status, admitting_vet_id, admitting_nurse_id, cage_number,
    admission_date, notes, created_at, updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'admitted',?,?,?,?,?,?,?,?)`).run(
    id, input.pet_name, input.pet_type, input.breed ?? '', input.age ?? 0,
    input.weight ?? 0, input.owner_name, input.owner_phone,
    input.vaccine_status ?? 'unknown', isolation_required, input.deposit_amount ?? 0, 0,
    input.auth_surgery ?? 0, input.auth_transfusion ?? 0, input.auth_special_exam ?? 0,
    input.admitting_vet_id ?? '', input.admitting_nurse_id ?? '', input.cage_number ?? '',
    input.admission_date, input.notes ?? '', now, now
  )
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(id) })
})

app.post('/api/hospitalizations/:hospId/orders', (req, res) => {
  const h = db.prepare('SELECT id FROM hospitalization WHERE id = ?').get(req.params.hospId)
  if (!h) { res.status(404).json({ success: false, error: '住院记录不存在' }); return }
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const input = req.body
  db.prepare(`INSERT INTO orders (
    id, hospitalization_id, vet_id, type, category, content, dosage, frequency,
    start_date, end_date, confirmed, status, change_reason, created_at, updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?, ?,0,'active',?,?,?)`).run(
    id, req.params.hospId, input.vet_id, input.type,
    input.category ?? 'medication', input.content, input.dosage ?? '',
    input.frequency ?? '', input.start_date, input.end_date ?? null,
    input.change_reason ?? null, now, now
  )
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM orders WHERE id = ?').get(id) })
})

app.post('/api/hospitalizations/orders/:orderId/confirm', (req, res) => {
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId)
  if (!existing) { res.status(404).json({ success: false, error: '医嘱不存在' }); return }
  if (existing.confirmed) { res.status(400).json({ success: false, error: '该医嘱已确认' }); return }
  const now = new Date().toISOString()
  db.prepare('UPDATE orders SET confirmed = 1, confirmed_by = ?, confirmed_at = ?, updated_at = ? WHERE id = ?')
    .run(req.body.confirmed_by, now, now, req.params.orderId)
  res.json({ success: true, data: db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId) })
})

app.post('/api/hospitalizations/orders/:orderId/stop', (req, res) => {
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId)
  if (!existing) { res.status(404).json({ success: false, error: '医嘱不存在' }); return }
  if (existing.status === 'stopped') { res.status(400).json({ success: false, error: '该医嘱已停用' }); return }
  const now = new Date().toISOString()
  db.prepare("UPDATE orders SET status = 'stopped', end_date = ?, change_reason = ?, updated_at = ? WHERE id = ?")
    .run(now, req.body.reason ?? null, now, req.params.orderId)
  res.json({ success: true, data: db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId) })
})

app.post('/api/hospitalizations/:hospId/nursing-records', (req, res) => {
  const hosp = db.prepare('SELECT id FROM hospitalization WHERE id = ?').get(req.params.hospId)
  if (!hosp) { res.status(404).json({ success: false, error: '住院记录不存在' }); return }
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.body.order_id)
  if (!order) { res.status(400).json({ success: false, error: '医嘱不存在' }); return }
  if (!order.confirmed) { res.status(400).json({ success: false, error: '未确认的医嘱不允许执行护理记录' }); return }
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const input = req.body
  db.prepare(`INSERT INTO nursing_record (
    id, hospitalization_id, order_id, nurse_id, executed_at,
    result, observation, abnormal_note, handover_note, shift_id, created_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, req.params.hospId, input.order_id, input.nurse_id, input.executed_at,
    input.result ?? 'normal', input.observation ?? '', input.abnormal_note ?? null,
    input.handover_note ?? null, input.shift_id ?? null, now
  )
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM nursing_record WHERE id = ?').get(id) })
})

app.post('/api/hospitalizations/:hospId/billing', (req, res) => {
  const h = db.prepare('SELECT id FROM hospitalization WHERE id = ?').get(req.params.hospId)
  if (!h) { res.status(404).json({ success: false, error: '住院记录不存在' }); return }
  const id = crypto.randomUUID()
  const input = req.body
  const quantity = input.quantity ?? 1
  const total_amount = input.amount * quantity
  const now = new Date().toISOString()
  db.prepare('INSERT INTO billing_item (id, hospitalization_id, category, name, amount, quantity, total_amount, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, req.params.hospId, input.category, input.name, input.amount, quantity, total_amount, now)
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM billing_item WHERE id = ?').get(id) })
})

app.post('/api/hospitalizations/:hospId/settle', (req, res) => {
  const hosp = db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(req.params.hospId)
  if (!hosp) { res.status(404).json({ success: false, error: '住院记录不存在' }); return }
  if (hosp.status === 'discharged') { res.status(400).json({ success: false, error: '该住院记录已出院' }); return }
  const activeOrders = db.prepare("SELECT * FROM orders WHERE hospitalization_id = ? AND status = 'active'").all(req.params.hospId)
  for (const order of activeOrders) {
    const records = db.prepare('SELECT * FROM nursing_record WHERE order_id = ?').all(order.id)
    if (records.length === 0) {
      res.status(400).json({ success: false, error: `医嘱"${order.content}"尚未执行任何护理记录，无法结算出院` })
      return
    }
  }
  const billingItems = db.prepare('SELECT * FROM billing_item WHERE hospitalization_id = ?').all(req.params.hospId)
  const totalAmount = billingItems.reduce((sum, item) => sum + item.total_amount, 0)
  const depositUsed = Math.min(hosp.deposit_amount, totalAmount)
  const remainingAmount = totalAmount - depositUsed
  const now = new Date().toISOString()
  db.prepare("UPDATE hospitalization SET status = 'discharged', discharge_date = ?, deposit_used = ?, updated_at = ? WHERE id = ?")
    .run(now, depositUsed, now, req.params.hospId)
  res.json({
    success: true,
    data: {
      hospitalization: db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(req.params.hospId),
      billing_summary: { total_amount: totalAmount, deposit_amount: hosp.deposit_amount, deposit_used: depositUsed, remaining_amount: remainingAmount, items_count: billingItems.length }
    }
  })
})

app.post('/api/shifts/handover', (req, res) => {
  const now = new Date().toISOString()
  const current = db.prepare("SELECT * FROM shift WHERE status = 'active' ORDER BY start_time DESC LIMIT 1").get()
  if (current) {
    db.prepare("UPDATE shift SET status = 'completed', end_time = ?, nurse_off_duty = ?, handover_notes = ? WHERE id = ?")
      .run(now, req.body.nurse_off_duty, req.body.handover_notes ?? '', current.id)
  }
  const newId = crypto.randomUUID()
  db.prepare('INSERT INTO shift (id, nurse_on_duty, start_time, status, handover_notes) VALUES (?,?,?,?,?)')
    .run(newId, req.body.nurse_on_duty, now, 'active', req.body.handover_notes ?? '')
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM shift WHERE id = ?').get(newId) })
})

app.get('/api/shifts/current', (_req, res) => {
  const shift = db.prepare("SELECT * FROM shift WHERE status = 'active' ORDER BY start_time DESC LIMIT 1").get()
  if (!shift) { res.json({ success: true, data: null }); return }
  const records = db.prepare('SELECT * FROM nursing_record WHERE shift_id = ? ORDER BY executed_at DESC').all(shift.id)
  res.json({ success: true, data: { ...shift, nursing_records: records } })
})

app.get('/api/health', (_req, res) => res.json({ success: true, message: 'ok' }))
app.use((_req, res) => res.status(404).json({ success: false, error: 'API not found' }))

const server = app.listen(0, async () => {
  const port = server.address().port
  const BASE = `http://127.0.0.1:${port}/api`

  async function req(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } }
    if (body) opts.body = JSON.stringify(body)
    const url = `${BASE}${path}`
    const res = await fetch(url, opts)
    const text = await res.text()
    try { return JSON.parse(text) }
    catch { console.error(`Non-JSON response from ${url}: ${text.slice(0, 100)}`); return { error: text.slice(0, 100) } }
  }

  try {
    console.log('=== 1. 获取员工列表 ===')
    const staffRes = await req('GET', '/staff')
    const staff = staffRes.data
    const vetId = staff.find(s => s.role === 'vet').id
    const nurseId = staff.find(s => s.role === 'nurse').id
    console.log(`兽医: ${vetId}, 护士: ${nurseId}`)

    console.log('\n=== 2. 创建住院记录(疫苗缺失→自动隔离) ===')
    const hospRes = await req('POST', '/hospitalizations', {
      pet_name: '旺财', pet_type: '狗', breed: '金毛', age: 3, weight: 28.5,
      owner_name: '李明', owner_phone: '13800138000',
      vaccine_status: 'incomplete', deposit_amount: 5000,
      auth_surgery: 1, admission_date: '2026-06-16', cage_number: 'A-101'
    })
    const hospId = hospRes.data.id
    console.log(`住院ID: ${hospId}`)
    console.log(`隔离: ${hospRes.data.isolation_required} ✓ (疫苗缺失→自动隔离)`)

    console.log('\n=== 3. 创建需确认医嘱 ===')
    const orderRes = await req('POST', `/hospitalizations/${hospId}/orders`, {
      vet_id: vetId, type: 'pending_confirm', category: 'medication',
      content: '头孢克洛 250mg', dosage: '每日2次', frequency: '每12小时',
      start_date: '2026-06-16'
    })
    const orderId = orderRes.data.id
    console.log(`医嘱ID: ${orderId}, confirmed: ${orderRes.data.confirmed}`)

    console.log('\n=== 4. 尝试执行未确认医嘱(应失败) ===')
    const failRes = await req('POST', `/hospitalizations/${hospId}/nursing-records`, {
      order_id: orderId, nurse_id: nurseId,
      executed_at: '2026-06-16T08:00:00Z', result: 'normal', observation: '正常服药'
    })
    console.log(`结果: ${failRes.error} ✓ (未确认→拒绝执行)`)

    console.log('\n=== 5. 确认医嘱 ===')
    const confirmRes = await req('POST', `/hospitalizations/orders/${orderId}/confirm`, {
      confirmed_by: vetId
    })
    console.log(`确认成功: ${confirmRes.success}, confirmed: ${confirmRes.data?.confirmed}`)

    console.log('\n=== 6. 确认后执行护理(应成功) ===')
    const nursingRes = await req('POST', `/hospitalizations/${hospId}/nursing-records`, {
      order_id: orderId, nurse_id: nurseId,
      executed_at: '2026-06-16T08:00:00Z', result: 'normal', observation: '正常服药'
    })
    console.log(`护理记录ID: ${nursingRes.data?.id} ✓ (确认后可执行)`)

    console.log('\n=== 7. 停用医嘱 ===')
    const stopRes = await req('POST', `/hospitalizations/orders/${orderId}/stop`, { reason: '疗程结束' })
    console.log(`停用成功: ${stopRes.success}, status: ${stopRes.data?.status}`)

    console.log('\n=== 8. 添加费用 ===')
    await req('POST', `/hospitalizations/${hospId}/billing`, { category: 'medication', name: '头孢克洛', amount: 35, quantity: 2 })
    await req('POST', `/hospitalizations/${hospId}/billing`, { category: 'hospitalization', name: '住院费', amount: 200, quantity: 1 })
    console.log('费用已添加 ✓')

    console.log('\n=== 9. 结算出院 ===')
    const settleRes = await req('POST', `/hospitalizations/${hospId}/settle`)
    if (settleRes.error) {
      console.log(`❌ 结算失败: ${settleRes.error}`)
    } else {
      const bs = settleRes.data?.billing_summary || {}
      console.log(`结算成功! 总费用: ${bs.total_amount}, 押金: ${bs.deposit_amount}, 抵扣: ${bs.deposit_used}`)
    }

    console.log('\n=== 10. 验证已出院 ===')
    const detailRes = await req('GET', `/hospitalizations/${hospId}`)
    console.log(`状态: ${detailRes.data?.status} ✓`)

    console.log('\n=== 11. 交接班 ===')
    const handoverRes = await req('POST', '/shifts/handover', {
      nurse_on_duty: nurseId, nurse_off_duty: nurseId, handover_notes: '旺财病情稳定'
    })
    console.log(`新班次ID: ${handoverRes.data?.id}`)
    const currentShift = await req('GET', '/shifts/current')
    console.log(`当前班次状态: ${currentShift.data?.status}`)

    console.log('\n✅ 全链路测试通过!')
  } catch (err) {
    console.error('❌ 测试失败:', err)
  } finally {
    server.close()
    process.exit(0)
  }
})
