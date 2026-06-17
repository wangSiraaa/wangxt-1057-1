import db from '../db.js'
import crypto from 'crypto'

export interface HospitalizationInput {
  pet_name: string
  pet_type: string
  breed?: string
  age?: number
  weight?: number
  owner_name: string
  owner_phone: string
  vaccine_status?: string
  isolation_required?: number
  deposit_amount?: number
  auth_surgery?: number
  auth_transfusion?: number
  auth_special_exam?: number
  admitting_vet_id?: string
  admitting_nurse_id?: string
  cage_number?: string
  admission_date: string
  notes?: string
}

export function listHospitalizations(status?: string) {
  if (status) {
    return db.prepare('SELECT * FROM hospitalization WHERE status = ? ORDER BY created_at DESC').all(status)
  }
  return db.prepare('SELECT * FROM hospitalization ORDER BY created_at DESC').all()
}

export function getHospitalizationById(id: string) {
  const h = db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(id) as Record<string, any> | undefined
  if (!h) return null
  const orders = db.prepare('SELECT * FROM orders WHERE hospitalization_id = ? ORDER BY created_at DESC').all(id)
  const nursing_records = db.prepare('SELECT * FROM nursing_record WHERE hospitalization_id = ? ORDER BY created_at DESC').all(id)
  const billing_items = db.prepare('SELECT * FROM billing_item WHERE hospitalization_id = ? ORDER BY created_at DESC').all(id)
  return { ...h, orders, nursing_records, billing_items }
}

export function createHospitalization(input: HospitalizationInput) {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  let isolation_required = input.isolation_required ?? 0
  if (input.vaccine_status === 'incomplete') {
    isolation_required = 1
  }

  db.prepare(`
    INSERT INTO hospitalization (
      id, pet_name, pet_type, breed, age, weight, owner_name, owner_phone,
      vaccine_status, isolation_required, deposit_amount, deposit_used,
      auth_surgery, auth_transfusion, auth_special_exam,
      status, admitting_vet_id, admitting_nurse_id, cage_number,
      admission_date, notes, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      'admitted', ?, ?, ?,
      ?, ?, ?, ?
    )
  `).run(
    id, input.pet_name, input.pet_type, input.breed ?? '', input.age ?? 0,
    input.weight ?? 0, input.owner_name, input.owner_phone,
    input.vaccine_status ?? 'unknown', isolation_required, input.deposit_amount ?? 0, 0,
    input.auth_surgery ?? 0, input.auth_transfusion ?? 0, input.auth_special_exam ?? 0,
    input.admitting_vet_id ?? '', input.admitting_nurse_id ?? '', input.cage_number ?? '',
    input.admission_date, input.notes ?? '', now, now
  )

  return db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(id)
}

export function updateHospitalization(id: string, input: Partial<HospitalizationInput>) {
  const existing = db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(id) as any
  if (!existing) return null

  const now = new Date().toISOString()
  const fields: string[] = []
  const values: any[] = []

  const allowedFields = [
    'pet_name', 'pet_type', 'breed', 'age', 'weight', 'owner_name', 'owner_phone',
    'vaccine_status', 'isolation_required', 'deposit_amount', 'deposit_used',
    'auth_surgery', 'auth_transfusion', 'auth_special_exam',
    'admitting_vet_id', 'admitting_nurse_id', 'cage_number', 'notes'
  ]

  for (const field of allowedFields) {
    if (input[field as keyof HospitalizationInput] !== undefined) {
      fields.push(`${field} = ?`)
      values.push((input as any)[field])
    }
  }

  if (input.vaccine_status === 'incomplete') {
    fields.push('isolation_required = ?')
    values.push(1)
  }

  if (fields.length === 0) return existing

  fields.push('updated_at = ?')
  values.push(now)
  values.push(id)

  db.prepare(`UPDATE hospitalization SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(id)
}

export function dischargeHospitalization(id: string) {
  const existing = db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(id) as any
  if (!existing) return null
  if (existing.status === 'discharged') return { error: '该住院记录已出院' }

  const activeOrders = db.prepare(
    "SELECT * FROM orders WHERE hospitalization_id = ? AND status = 'active'"
  ).all(id) as any[]

  for (const order of activeOrders) {
    const records = db.prepare(
      'SELECT * FROM nursing_record WHERE order_id = ?'
    ).all(order.id)
    if (records.length === 0) {
      return { error: `医嘱"${order.content}"尚未执行任何护理记录，无法出院` }
    }
  }

  const now = new Date().toISOString()
  db.prepare(
    "UPDATE hospitalization SET status = 'discharged', discharge_date = ?, updated_at = ? WHERE id = ?"
  ).run(now, now, id)

  return db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(id)
}

export function getStatistics() {
  const admittedList = db.prepare("SELECT * FROM hospitalization WHERE status = 'admitted'").all() as any[]

  const admittedCount = admittedList.length
  let pendingOrdersCount = 0
  let pendingNursingCount = 0
  let alertCount = 0
  let criticalCount = 0
  let pendingMedTaskCount = 0

  const today = new Date().toISOString().slice(0, 10)
  const currentShift = db.prepare(
    "SELECT id FROM shift WHERE status = 'active' ORDER BY start_time DESC LIMIT 1"
  ).get() as { id: string } | undefined

  for (const h of admittedList) {
    const orders = db.prepare(
      "SELECT * FROM orders WHERE hospitalization_id = ? AND status = 'active'"
    ).all(h.id) as any[]

    if (orders.length === 0) {
      pendingOrdersCount++
    }

    for (const order of orders) {
      const todayRecords = db.prepare(
        "SELECT * FROM nursing_record WHERE order_id = ? AND DATE(executed_at) = ?"
      ).all(order.id, today)
      if (todayRecords.length === 0 && order.confirmed) {
        pendingNursingCount++
      }
    }

    const depositRemaining = h.deposit_amount - h.deposit_used
    if (h.vaccine_status === 'incomplete' || depositRemaining <= 0) {
      alertCount++
    }

    if (h.is_critical) {
      criticalCount++
      if (currentShift) {
        const obs = db.prepare(
          'SELECT id FROM critical_observation WHERE hospitalization_id = ? AND shift_id = ?'
        ).get(h.id, currentShift.id)
        if (!obs) {
          alertCount++
        }
      }
    }
  }

  const medTaskResult = db.prepare(
    "SELECT COUNT(*) as cnt FROM medication_task WHERE status = 'pending'"
  ).get() as { cnt: number }
  pendingMedTaskCount = medTaskResult.cnt

  return {
    admittedCount,
    pendingOrdersCount,
    pendingNursingCount,
    alertCount,
    criticalCount,
    pendingMedTaskCount,
  }
}
