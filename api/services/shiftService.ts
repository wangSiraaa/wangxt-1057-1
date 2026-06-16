import db from '../db.js'
import crypto from 'crypto'

export interface HandoverInput {
  nurse_on_duty: string
  nurse_off_duty: string
  handover_notes?: string
}

export function getCurrentShift() {
  const shift = db.prepare(
    "SELECT * FROM shift WHERE status = 'active' ORDER BY start_time DESC LIMIT 1"
  ).get() as any
  if (!shift) return null

  const records = db.prepare(
    'SELECT * FROM nursing_record WHERE shift_id = ? ORDER BY executed_at DESC'
  ).all(shift.id)

  return { ...shift, nursing_records: records }
}

export function handover(input: HandoverInput) {
  const now = new Date().toISOString()

  const currentShift = db.prepare(
    "SELECT * FROM shift WHERE status = 'active' ORDER BY start_time DESC LIMIT 1"
  ).get() as any

  if (currentShift) {
    db.prepare(
      "UPDATE shift SET status = 'handed_over', end_time = ?, nurse_off_duty = ?, handover_notes = ? WHERE id = ?"
    ).run(now, input.nurse_off_duty, input.handover_notes ?? '', currentShift.id)
  }

  const newId = crypto.randomUUID()
  db.prepare(
    'INSERT INTO shift (id, nurse_on_duty, start_time, status, handover_notes) VALUES (?, ?, ?, ?, ?)'
  ).run(newId, input.nurse_on_duty, now, 'active', input.handover_notes ?? '')

  return db.prepare('SELECT * FROM shift WHERE id = ?').get(newId)
}

export function getShiftSummary(shiftId: string) {
  const shift = db.prepare('SELECT * FROM shift WHERE id = ?').get(shiftId) as any
  if (!shift) return null

  const records = db.prepare(
    'SELECT * FROM nursing_record WHERE shift_id = ? ORDER BY executed_at DESC'
  ).all(shiftId)

  const activeOrders = db.prepare(
    "SELECT * FROM orders WHERE status = 'active' AND hospitalization_id IN (SELECT id FROM hospitalization WHERE status = 'admitted')"
  ).all()

  const abnormalRecords = records.filter((r: any) => r.result === 'abnormal')

  return {
    shift,
    total_records: records.length,
    abnormal_records: abnormalRecords,
    active_orders_count: activeOrders.length,
    nursing_records: records,
  }
}
