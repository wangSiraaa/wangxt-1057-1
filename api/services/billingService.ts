import db from '../db.js'
import crypto from 'crypto'

export interface BillingInput {
  category: string
  name: string
  amount: number
  quantity?: number
}

export function listBillingItems(hospitalizationId: string) {
  return db.prepare(
    'SELECT * FROM billing_item WHERE hospitalization_id = ? ORDER BY created_at DESC'
  ).all(hospitalizationId)
}

export function createBillingItem(hospitalizationId: string, input: BillingInput) {
  const hosp = db.prepare('SELECT id FROM hospitalization WHERE id = ?').get(hospitalizationId)
  if (!hosp) return null

  const id = crypto.randomUUID()
  const quantity = input.quantity ?? 1
  const total_amount = input.amount * quantity
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO billing_item (id, hospitalization_id, category, name, amount, quantity, total_amount, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, hospitalizationId, input.category, input.name, input.amount, quantity, total_amount, now)

  return db.prepare('SELECT * FROM billing_item WHERE id = ?').get(id)
}

export function settleAndDischarge(hospitalizationId: string) {
  const hosp = db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(hospitalizationId) as any
  if (!hosp) return null
  if (hosp.status === 'discharged') return { error: '该住院记录已出院' }

  const activeOrders = db.prepare(
    "SELECT * FROM orders WHERE hospitalization_id = ? AND status = 'active'"
  ).all(hospitalizationId) as any[]

  for (const order of activeOrders) {
    const records = db.prepare(
      'SELECT * FROM nursing_record WHERE order_id = ?'
    ).all(order.id)
    if (records.length === 0) {
      return { error: `医嘱"${order.content}"尚未执行任何护理记录，无法结算出院` }
    }
  }

  const billingItems = db.prepare(
    'SELECT * FROM billing_item WHERE hospitalization_id = ?'
  ).all(hospitalizationId) as any[]

  const totalAmount = billingItems.reduce((sum: number, item: any) => sum + item.total_amount, 0)
  const depositUsed = Math.min(hosp.deposit_amount, totalAmount)
  const remainingAmount = totalAmount - depositUsed

  const now = new Date().toISOString()
  db.prepare(
    "UPDATE hospitalization SET status = 'discharged', discharge_date = ?, deposit_used = ?, updated_at = ? WHERE id = ?"
  ).run(now, depositUsed, now, hospitalizationId)

  const updated = db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(hospitalizationId)

  return {
    hospitalization: updated,
    billing_summary: {
      total_amount: totalAmount,
      deposit_amount: hosp.deposit_amount,
      deposit_used: depositUsed,
      remaining_amount: remainingAmount,
      items_count: billingItems.length,
    },
  }
}
