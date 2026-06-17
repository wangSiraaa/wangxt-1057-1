import db from '../db.js'
import crypto from 'crypto'

export interface CriticalObservationInput {
  hospitalization_id: string
  shift_id: string
  nurse_id: string
  temperature?: number
  heart_rate?: number
  respiratory_rate?: number
  blood_pressure_systolic?: number
  blood_pressure_diastolic?: number
  oxygen_saturation?: number
  mental_status?: string
  appetite?: string
  clinical_signs?: string
  intervention?: string
  notes?: string
  recorded_at: string
}

export interface SupplementObservationInput extends CriticalObservationInput {
  supplement_for_shift_id: string
}

export function markCritical(hospitalizationId: string, markedBy: string) {
  const existing = db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(hospitalizationId) as any
  if (!existing) return null
  if (existing.is_critical) return { error: '该宠物已标记为重症' }

  const now = new Date().toISOString()
  db.prepare(
    'UPDATE hospitalization SET is_critical = 1, critical_marked_by = ?, critical_marked_at = ?, updated_at = ? WHERE id = ?'
  ).run(markedBy, now, now, hospitalizationId)

  return db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(hospitalizationId)
}

export function unmarkCritical(hospitalizationId: string) {
  const existing = db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(hospitalizationId) as any
  if (!existing) return null
  if (!existing.is_critical) return { error: '该宠物未标记为重症' }

  const now = new Date().toISOString()
  db.prepare(
    'UPDATE hospitalization SET is_critical = 0, critical_marked_by = NULL, critical_marked_at = NULL, updated_at = ? WHERE id = ?'
  ).run(now, hospitalizationId)

  return db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(hospitalizationId)
}

export function listCriticalObservations(hospitalizationId: string) {
  return db.prepare(
    'SELECT * FROM critical_observation WHERE hospitalization_id = ? ORDER BY recorded_at DESC'
  ).all(hospitalizationId)
}

export function getShiftCriticalObservation(hospitalizationId: string, shiftId: string) {
  return db.prepare(
    'SELECT * FROM critical_observation WHERE hospitalization_id = ? AND shift_id = ? ORDER BY recorded_at DESC LIMIT 1'
  ).get(hospitalizationId, shiftId)
}

export function createCriticalObservation(input: CriticalObservationInput) {
  const hosp = db.prepare('SELECT id, is_critical FROM hospitalization WHERE id = ?').get(input.hospitalization_id) as any
  if (!hosp) return null
  if (!hosp.is_critical) return { error: '非重症宠物无需填写重症观察记录' }

  const shift = db.prepare('SELECT id FROM shift WHERE id = ?').get(input.shift_id)
  if (!shift) return { error: '班次不存在' }

  const existing = db.prepare(
    'SELECT id FROM critical_observation WHERE hospitalization_id = ? AND shift_id = ?'
  ).get(input.hospitalization_id, input.shift_id)
  if (existing) return { error: '本班次已填写重症观察记录' }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO critical_observation (
      id, hospitalization_id, shift_id, nurse_id, temperature, heart_rate,
      respiratory_rate, blood_pressure_systolic, blood_pressure_diastolic,
      oxygen_saturation, mental_status, appetite, clinical_signs, intervention,
      notes, is_supplement, supplement_for_shift_id, recorded_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
  `).run(
    id, input.hospitalization_id, input.shift_id, input.nurse_id,
    input.temperature ?? null, input.heart_rate ?? null,
    input.respiratory_rate ?? null, input.blood_pressure_systolic ?? null,
    input.blood_pressure_diastolic ?? null, input.oxygen_saturation ?? null,
    input.mental_status ?? null, input.appetite ?? null,
    input.clinical_signs ?? null, input.intervention ?? null,
    input.notes ?? null, input.recorded_at, now
  )

  return db.prepare('SELECT * FROM critical_observation WHERE id = ?').get(id)
}

export function checkCriticalObservationForShift(shiftId: string) {
  const criticalPets = db.prepare(
    "SELECT id, pet_name FROM hospitalization WHERE status = 'admitted' AND is_critical = 1"
  ).all() as any[]

  const missing: any[] = []
  for (const pet of criticalPets) {
    const obs = db.prepare(
      'SELECT id FROM critical_observation WHERE hospitalization_id = ? AND shift_id = ?'
    ).get(pet.id, shiftId)
    if (!obs) {
      missing.push(pet)
    }
  }

  return {
    criticalCount: criticalPets.length,
    missingCount: missing.length,
    missingPets: missing,
  }
}

export function supplementCriticalObservation(input: SupplementObservationInput) {
  const hosp = db.prepare('SELECT id, is_critical FROM hospitalization WHERE id = ?').get(input.hospitalization_id) as any
  if (!hosp) return null
  if (!hosp.is_critical) return { error: '非重症宠物无需补录观察记录' }

  const targetShift = db.prepare('SELECT id FROM shift WHERE id = ?').get(input.supplement_for_shift_id)
  if (!targetShift) return { error: '目标班次不存在' }

  const alreadySupplemented = db.prepare(
    'SELECT id FROM critical_observation WHERE hospitalization_id = ? AND supplement_for_shift_id = ?'
  ).get(input.hospitalization_id, input.supplement_for_shift_id)
  if (alreadySupplemented) return { error: '该班次已补录过观察记录' }

  const directRecord = db.prepare(
    'SELECT id FROM critical_observation WHERE hospitalization_id = ? AND shift_id = ? AND is_supplement = 0'
  ).get(input.hospitalization_id, input.supplement_for_shift_id)
  if (directRecord) return { error: '该班次已有正常观察记录，无需补录' }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO critical_observation (
      id, hospitalization_id, shift_id, nurse_id, temperature, heart_rate,
      respiratory_rate, blood_pressure_systolic, blood_pressure_diastolic,
      oxygen_saturation, mental_status, appetite, clinical_signs, intervention,
      notes, is_supplement, supplement_for_shift_id, recorded_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(
    id, input.hospitalization_id, input.shift_id, input.nurse_id,
    input.temperature ?? null, input.heart_rate ?? null,
    input.respiratory_rate ?? null, input.blood_pressure_systolic ?? null,
    input.blood_pressure_diastolic ?? null, input.oxygen_saturation ?? null,
    input.mental_status ?? null, input.appetite ?? null,
    input.clinical_signs ?? null, input.intervention ?? null,
    input.notes ?? null, input.supplement_for_shift_id, input.recorded_at, now
  )

  return db.prepare('SELECT * FROM critical_observation WHERE id = ?').get(id)
}

export function getMissingObservationsForShift(shiftId: string) {
  const criticalPets = db.prepare(
    "SELECT id, pet_name FROM hospitalization WHERE status = 'admitted' AND is_critical = 1"
  ).all() as any[]

  const missing: any[] = []
  for (const pet of criticalPets) {
    const hasRecord = db.prepare(
      'SELECT id FROM critical_observation WHERE hospitalization_id = ? AND (shift_id = ? OR supplement_for_shift_id = ?)'
    ).get(pet.id, shiftId, shiftId)
    if (!hasRecord) {
      missing.push(pet)
    }
  }

  return missing
}
