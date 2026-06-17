import db from '../db.js'
import crypto from 'crypto'

export interface MedicationTaskInput {
  hospitalization_id: string
  order_id: string
  medication_name: string
  required_quantity: number
  available_quantity: number
  pending_quantity: number
  priority?: string
  assigned_to?: string
  notes?: string
}

export function listMedicationTasks(hospitalizationId?: string, status?: string) {
  let sql = 'SELECT * FROM medication_task WHERE 1=1'
  const params: any[] = []

  if (hospitalizationId) {
    sql += ' AND hospitalization_id = ?'
    params.push(hospitalizationId)
  }
  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }
  sql += ' ORDER BY created_at DESC'

  return db.prepare(sql).all(...params)
}

export function getMedicationTask(taskId: string) {
  return db.prepare('SELECT * FROM medication_task WHERE id = ?').get(taskId)
}

export function createMedicationTask(input: MedicationTaskInput) {
  const hosp = db.prepare('SELECT id FROM hospitalization WHERE id = ?').get(input.hospitalization_id)
  if (!hosp) return null

  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(input.order_id)
  if (!order) return { error: '医嘱不存在' }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO medication_task (
      id, hospitalization_id, order_id, medication_name, required_quantity,
      available_quantity, pending_quantity, status, priority, assigned_to, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
  `).run(
    id, input.hospitalization_id, input.order_id, input.medication_name,
    input.required_quantity, input.available_quantity, input.pending_quantity,
    input.priority ?? 'normal', input.assigned_to ?? null, input.notes ?? null, now
  )

  return db.prepare('SELECT * FROM medication_task WHERE id = ?').get(id)
}

export function updateMedicationTask(taskId: string, updates: Partial<MedicationTaskInput> & { status?: string; completed_at?: string }) {
  const existing = db.prepare('SELECT * FROM medication_task WHERE id = ?').get(taskId) as any
  if (!existing) return null

  const fields: string[] = []
  const values: any[] = []

  const allowedFields = [
    'medication_name', 'required_quantity', 'available_quantity',
    'pending_quantity', 'status', 'priority', 'assigned_to', 'notes'
  ]

  for (const field of allowedFields) {
    if ((updates as any)[field] !== undefined) {
      fields.push(`${field} = ?`)
      values.push((updates as any)[field])
    }
  }

  if (updates.status === 'completed') {
    fields.push('completed_at = ?')
    values.push(new Date().toISOString())
  }

  if (fields.length === 0) return existing

  values.push(taskId)
  db.prepare(`UPDATE medication_task SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM medication_task WHERE id = ?').get(taskId)
}

export function completeMedicationTask(taskId: string, notes?: string) {
  const existing = db.prepare('SELECT * FROM medication_task WHERE id = ?').get(taskId) as any
  if (!existing) return null
  if (existing.status === 'completed') return { error: '该补药任务已完成' }

  const now = new Date().toISOString()
  db.prepare(
    "UPDATE medication_task SET status = 'completed', completed_at = ?, notes = COALESCE(?, notes) WHERE id = ?"
  ).run(now, notes ?? null, taskId)

  return db.prepare('SELECT * FROM medication_task WHERE id = ?').get(taskId)
}

export function checkStockAndCreateTask(orderId: string, medicationName: string, requiredQty: number, stockQty: number) {
  if (stockQty >= requiredQty) {
    return { sufficient: true, task: null }
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any
  if (!order) return { error: '医嘱不存在' }

  db.prepare(
    'UPDATE orders SET medication_name = ?, medication_quantity = ?, medication_stock_available = ?, stock_checked = 1, updated_at = ? WHERE id = ?'
  ).run(medicationName, requiredQty, stockQty, new Date().toISOString(), orderId)

  const task = createMedicationTask({
    hospitalization_id: order.hospitalization_id,
    order_id: orderId,
    medication_name: medicationName,
    required_quantity: requiredQty,
    available_quantity: stockQty,
    pending_quantity: requiredQty - stockQty,
    priority: requiredQty - stockQty > requiredQty * 0.5 ? 'urgent' : 'normal',
  })

  return { sufficient: false, task }
}

export function getPendingMedicationTasksCount() {
  const result = db.prepare(
    "SELECT COUNT(*) as cnt FROM medication_task WHERE status = 'pending'"
  ).get() as { cnt: number }
  return result.cnt
}
