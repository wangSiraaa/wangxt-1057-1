import db from '../db.js'
import crypto from 'crypto'

export interface NursingRecordInput {
  order_id: string
  nurse_id: string
  executed_at: string
  result?: string
  observation?: string
  abnormal_note?: string
  handover_note?: string
  shift_id?: string
}

export function listNursingRecords(hospitalizationId: string) {
  return db.prepare(
    'SELECT * FROM nursing_record WHERE hospitalization_id = ? ORDER BY executed_at DESC'
  ).all(hospitalizationId)
}

export function createNursingRecord(hospitalizationId: string, input: NursingRecordInput) {
  const hosp = db.prepare('SELECT id FROM hospitalization WHERE id = ?').get(hospitalizationId)
  if (!hosp) return null

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(input.order_id) as any
  if (!order) return { error: '医嘱不存在' }
  if (!order.confirmed) return { error: '未确认的医嘱不允许执行护理记录' }
  if (order.status !== 'active') return { error: '该医嘱已停用或已完成，不允许执行护理记录' }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO nursing_record (
      id, hospitalization_id, order_id, nurse_id, executed_at,
      result, observation, abnormal_note, handover_note, shift_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, hospitalizationId, input.order_id, input.nurse_id, input.executed_at,
    input.result ?? 'normal', input.observation ?? '', input.abnormal_note ?? null,
    input.handover_note ?? null, input.shift_id ?? null, now
  )

  return db.prepare('SELECT * FROM nursing_record WHERE id = ?').get(id)
}

export function updateNursingRecord(recordId: string, input: Partial<NursingRecordInput>) {
  const existing = db.prepare('SELECT * FROM nursing_record WHERE id = ?').get(recordId) as any
  if (!existing) return null

  const fields: string[] = []
  const values: any[] = []

  const allowedFields = [
    'executed_at', 'result', 'observation', 'abnormal_note', 'handover_note', 'shift_id'
  ]

  for (const field of allowedFields) {
    if (input[field as keyof NursingRecordInput] !== undefined) {
      fields.push(`${field} = ?`)
      values.push((input as any)[field])
    }
  }

  if (fields.length === 0) return existing

  values.push(recordId)
  db.prepare(`UPDATE nursing_record SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM nursing_record WHERE id = ?').get(recordId)
}
