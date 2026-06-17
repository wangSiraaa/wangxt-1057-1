import db from '../db.js'
import crypto from 'crypto'

export interface BillingInput {
  category: string
  name: string
  amount: number
  quantity?: number
  order_id?: string
  nursing_record_id?: string
  status?: string
}

export interface TerminateItemInput {
  reason: string
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
    INSERT INTO billing_item (id, hospitalization_id, category, name, amount, quantity, total_amount, status, order_id, nursing_record_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, hospitalizationId, input.category, input.name, input.amount, quantity,
    total_amount, input.status ?? 'completed',
    input.order_id ?? null, input.nursing_record_id ?? null, now
  )

  return db.prepare('SELECT * FROM billing_item WHERE id = ?').get(id)
}

export function terminateBillingItem(itemId: string, reason: string, category?: string) {
  const existing = db.prepare('SELECT * FROM billing_item WHERE id = ?').get(itemId) as any
  if (!existing) return null
  if (existing.status === 'terminated') return { error: '该费用项目已终止' }

  const now = new Date().toISOString()
  db.prepare(
    "UPDATE billing_item SET status = 'terminated', terminated_reason = ?, terminated_at = ?, termination_category = ? WHERE id = ?"
  ).run(reason, now, category ?? null, itemId)

  return db.prepare('SELECT * FROM billing_item WHERE id = ?').get(itemId)
}

export function terminateNursingRecord(recordId: string, reason: string, category?: string) {
  const existing = db.prepare('SELECT * FROM nursing_record WHERE id = ?').get(recordId) as any
  if (!existing) return null
  if (existing.status === 'terminated') return { error: '该护理记录已终止' }

  const now = new Date().toISOString()
  db.prepare(
    "UPDATE nursing_record SET status = 'terminated', terminated_reason = ?, terminated_at = ?, termination_category = ? WHERE id = ?"
  ).run(reason, now, category ?? null, recordId)

  return db.prepare('SELECT * FROM nursing_record WHERE id = ?').get(recordId)
}

export function getDischargeClosureSummary(hospitalizationId: string) {
  const hosp = db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(hospitalizationId) as any
  if (!hosp) return null

  const orders = db.prepare(
    'SELECT * FROM orders WHERE hospitalization_id = ?'
  ).all(hospitalizationId) as any[]

  const nursingRecords = db.prepare(
    'SELECT * FROM nursing_record WHERE hospitalization_id = ?'
  ).all(hospitalizationId) as any[]

  const billingItems = db.prepare(
    'SELECT * FROM billing_item WHERE hospitalization_id = ?'
  ).all(hospitalizationId) as any[]

  const criticalObservations = db.prepare(
    'SELECT * FROM critical_observation WHERE hospitalization_id = ?'
  ).all(hospitalizationId) as any[]

  const medTasks = db.prepare(
    'SELECT * FROM medication_task WHERE hospitalization_id = ?'
  ).all(hospitalizationId) as any[]

  const completedNursing = nursingRecords.filter((r: any) => r.status === 'completed')
  const terminatedNursing = nursingRecords.filter((r: any) => r.status === 'terminated')
  const earlyDischargeNursing = terminatedNursing.filter((r: any) => r.termination_category === 'early_discharge')
  const clinicalTerminatedNursing = terminatedNursing.filter((r: any) => r.termination_category !== 'early_discharge')
  const completedBilling = billingItems.filter((i: any) => i.status === 'completed')
  const terminatedBilling = billingItems.filter((i: any) => i.status === 'terminated')
  const earlyDischargeBilling = terminatedBilling.filter((i: any) => i.termination_category === 'early_discharge')
  const clinicalTerminatedBilling = terminatedBilling.filter((i: any) => i.termination_category !== 'early_discharge')
  const pendingMedTasks = medTasks.filter((t: any) => t.status === 'pending')

  const unclosedItems: any[] = []

  for (const order of orders) {
    if (order.status === 'active') {
      const orderRecords = nursingRecords.filter((r: any) => r.order_id === order.id && r.status === 'completed')
      if (orderRecords.length === 0) {
        unclosedItems.push({
          type: 'order',
          id: order.id,
          name: order.content,
          status: 'unexecuted',
          message: '医嘱未执行',
        })
      }
    }
  }

  for (const task of pendingMedTasks) {
    unclosedItems.push({
      type: 'medication_task',
      id: task.id,
      name: task.medication_name,
      status: 'pending',
      message: `待补药 ${task.pending_quantity}`,
    })
  }

  if (hosp.is_critical && criticalObservations.length === 0) {
    unclosedItems.push({
      type: 'critical_observation',
      id: hosp.id,
      name: '重症观察',
      status: 'missing',
      message: '重症宠物观察记录缺失',
    })
  }

  return {
    hospitalization: hosp,
    summary: {
      orderCount: orders.length,
      nursingCompletedCount: completedNursing.length,
      nursingTerminatedCount: terminatedNursing.length,
      nursingEarlyDischargeCount: earlyDischargeNursing.length,
      nursingClinicalTerminatedCount: clinicalTerminatedNursing.length,
      billingCompletedCount: completedBilling.length,
      billingTerminatedCount: terminatedBilling.length,
      billingEarlyDischargeCount: earlyDischargeBilling.length,
      billingClinicalTerminatedCount: clinicalTerminatedBilling.length,
      pendingMedicationTaskCount: pendingMedTasks.length,
      unclosedItemCount: unclosedItems.length,
    },
    completedNursing,
    terminatedNursing,
    earlyDischargeNursing,
    clinicalTerminatedNursing,
    completedBilling,
    terminatedBilling,
    earlyDischargeBilling,
    clinicalTerminatedBilling,
    pendingMedicationTasks: pendingMedTasks,
    unclosedItems,
    canDischarge: unclosedItems.length === 0,
  }
}

export function settleAndDischarge(hospitalizationId: string, earlyDischargeReason?: string) {
  const hosp = db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(hospitalizationId) as any
  if (!hosp) return null
  if (hosp.status === 'discharged') return { error: '该住院记录已出院' }

  const closure = getDischargeClosureSummary(hospitalizationId) as any
  if (!closure.canDischarge && !earlyDischargeReason) {
    return {
      error: '存在未闭环事项，请处理完成后再结算出院，或提供提前出院原因标记终止',
      closure,
    }
  }

  if (earlyDischargeReason) {
    const activeOrders = db.prepare(
      "SELECT * FROM orders WHERE hospitalization_id = ? AND status = 'active'"
    ).all(hospitalizationId) as any[]

    for (const order of activeOrders) {
      const records = db.prepare(
        "SELECT * FROM nursing_record WHERE order_id = ? AND status = 'completed'"
      ).all(order.id)
      if (records.length === 0) {
        db.prepare(
          "UPDATE orders SET status = 'stopped', change_reason = ?, end_date = ?, updated_at = ? WHERE id = ?"
        ).run(`提前出院：${earlyDischargeReason}`, new Date().toISOString(), new Date().toISOString(), order.id)

        const pendingRecords = db.prepare(
          "SELECT * FROM nursing_record WHERE order_id = ? AND status != 'completed' AND status != 'terminated'"
        ).all(order.id) as any[]
        for (const rec of pendingRecords) {
          db.prepare(
            "UPDATE nursing_record SET status = 'terminated', terminated_reason = ?, terminated_at = ?, termination_category = 'early_discharge' WHERE id = ?"
          ).run(`提前出院：${earlyDischargeReason}`, new Date().toISOString(), rec.id)
        }
      }
    }

    const pendingTasks = db.prepare(
      "SELECT * FROM medication_task WHERE hospitalization_id = ? AND status = 'pending'"
    ).all(hospitalizationId) as any[]
    for (const task of pendingTasks) {
      db.prepare(
        "UPDATE medication_task SET status = 'cancelled', notes = COALESCE(notes, '') || ? WHERE id = ?"
      ).run(`；提前出院终止：${earlyDischargeReason}`, task.id)
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
    "UPDATE hospitalization SET status = 'discharged', discharge_date = ?, deposit_used = ?, notes = COALESCE(notes, '') || ?, updated_at = ? WHERE id = ?"
  ).run(now, depositUsed, earlyDischargeReason ? `\n提前出院原因：${earlyDischargeReason}` : '', now, hospitalizationId)

  const updated = db.prepare('SELECT * FROM hospitalization WHERE id = ?').get(hospitalizationId)

  const finalClosure = getDischargeClosureSummary(hospitalizationId)

  return {
    hospitalization: updated,
    billing_summary: {
      total_amount: totalAmount,
      deposit_amount: hosp.deposit_amount,
      deposit_used: depositUsed,
      remaining_amount: remainingAmount,
      items_count: billingItems.length,
    },
    closure_summary: finalClosure,
  }
}
