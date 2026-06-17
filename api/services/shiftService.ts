import db from '../db.js'
import crypto from 'crypto'
import { getMissingObservationsForShift, checkCriticalObservationForShift } from './criticalCareService.js'

export interface HandoverInput {
  nurse_on_duty: string
  nurse_off_duty: string
  handover_notes?: string
  force_handover?: boolean
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

export function getHandoverChecklist(shiftId: string) {
  const criticalCheck = checkCriticalObservationForShift(shiftId)

  const previousShift = db.prepare(
    "SELECT * FROM shift WHERE status = 'handed_over' ORDER BY end_time DESC LIMIT 1"
  ).get() as any

  let previousShiftMissing: any[] = []
  if (previousShift) {
    previousShiftMissing = getMissingObservationsForShift(previousShift.id)
  }

  const pendingOrders = db.prepare(`
    SELECT o.*, h.pet_name 
    FROM orders o 
    JOIN hospitalization h ON o.hospitalization_id = h.id 
    WHERE o.status = 'active' AND o.confirmed = 1
    AND h.status = 'admitted'
    AND NOT EXISTS (
      SELECT 1 FROM nursing_record nr 
      WHERE nr.order_id = o.id AND nr.shift_id = ? AND nr.status = 'completed'
    )
  `).all(shiftId) as any[]

  const pendingMedTasks = db.prepare(`
    SELECT mt.*, h.pet_name 
    FROM medication_task mt
    JOIN hospitalization h ON mt.hospitalization_id = h.id
    WHERE mt.status = 'pending'
  `).all() as any[]

  return {
    criticalObservations: criticalCheck,
    previousShiftMissing: {
      shiftId: previousShift?.id ?? null,
      missingCount: previousShiftMissing.length,
      missingPets: previousShiftMissing,
    },
    pendingOrders: {
      count: pendingOrders.length,
      items: pendingOrders,
    },
    pendingMedicationTasks: {
      count: pendingMedTasks.length,
      items: pendingMedTasks,
    },
    canHandover: criticalCheck.missingCount === 0 && previousShiftMissing.length === 0,
  }
}

export function handover(input: HandoverInput) {
  const now = new Date().toISOString()

  const currentShift = db.prepare(
    "SELECT * FROM shift WHERE status = 'active' ORDER BY start_time DESC LIMIT 1"
  ).get() as any

  if (currentShift && !input.force_handover) {
    const checklist = getHandoverChecklist(currentShift.id)
    if (!checklist.canHandover) {
      const reasons: string[] = []
      if (checklist.criticalObservations.missingCount > 0) {
        reasons.push(`${checklist.criticalObservations.missingCount}只重症宠物本班次未填写观察记录`)
      }
      if (checklist.previousShiftMissing.missingCount > 0) {
        reasons.push(`${checklist.previousShiftMissing.missingCount}只重症宠物上班次观察记录缺失未补录`)
      }
      return {
        error: `无法交接：${reasons.join('；')}。请先补录后再交接`,
        checklist,
      }
    }
  }

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
