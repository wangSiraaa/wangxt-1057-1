import db from '../db.js'
import crypto from 'crypto'

export interface OrderInput {
  vet_id: string
  type: string
  category?: string
  content: string
  dosage?: string
  frequency?: string
  start_date: string
  end_date?: string
  change_reason?: string
}

export function listOrders(hospitalizationId: string) {
  return db.prepare(
    'SELECT * FROM orders WHERE hospitalization_id = ? ORDER BY created_at DESC'
  ).all(hospitalizationId)
}

export function createOrder(hospitalizationId: string, input: OrderInput) {
  const hosp = db.prepare('SELECT id FROM hospitalization WHERE id = ?').get(hospitalizationId)
  if (!hosp) return null

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO orders (
      id, hospitalization_id, vet_id, type, category, content, dosage, frequency,
      start_date, end_date, confirmed, status, change_reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?, ?)
  `).run(
    id, hospitalizationId, input.vet_id, input.type,
    input.category ?? 'medication', input.content, input.dosage ?? '',
    input.frequency ?? '', input.start_date, input.end_date ?? null,
    input.change_reason ?? null, now, now
  )

  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
}

export function updateOrder(orderId: string, input: Partial<OrderInput>) {
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any
  if (!existing) return null

  const now = new Date().toISOString()
  const fields: string[] = []
  const values: any[] = []

  const allowedFields = [
    'type', 'category', 'content', 'dosage', 'frequency', 'end_date', 'change_reason'
  ]

  for (const field of allowedFields) {
    if (input[field as keyof OrderInput] !== undefined) {
      fields.push(`${field} = ?`)
      values.push((input as any)[field])
    }
  }

  if (fields.length === 0) return existing

  fields.push('updated_at = ?')
  values.push(now)
  values.push(orderId)

  db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
}

export function confirmOrder(orderId: string, confirmedBy: string) {
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any
  if (!existing) return null
  if (existing.confirmed) return { error: '该医嘱已确认' }

  const now = new Date().toISOString()
  db.prepare(
    'UPDATE orders SET confirmed = 1, confirmed_by = ?, confirmed_at = ?, updated_at = ? WHERE id = ?'
  ).run(confirmedBy, now, now, orderId)

  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
}

export function stopOrder(orderId: string, reason?: string) {
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any
  if (!existing) return null
  if (existing.status === 'stopped') return { error: '该医嘱已停用' }

  const now = new Date().toISOString()
  db.prepare(
    "UPDATE orders SET status = 'stopped', end_date = ?, change_reason = ?, updated_at = ? WHERE id = ?"
  ).run(now, reason ?? null, now, orderId)

  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
}
