import type {
  Hospitalization,
  HospitalizationDetail,
  Order,
  NursingRecord,
  BillingSummary,
  BillingItem,
  Shift,
  Staff,
  CriticalObservation,
  MedicationTask,
  HandoverChecklist,
  DischargeClosureSummary,
} from 'shared/types'

const BASE = '/api'

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

function transformKeys(obj: unknown, transformer: (key: string) => string): unknown {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map((item) => transformKeys(item, transformer))
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[transformer(key)] = transformKeys(value, transformer)
    }
    return result
  }
  return obj
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let body: string | undefined
  if (options?.body) {
    const parsed = JSON.parse(options.body as string)
    body = JSON.stringify(transformKeys(parsed, toSnakeCase))
  }

  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    const error = new Error(err.error || err.message || `请求失败: ${res.status}`)
    ;(error as any).extra = transformKeys(err, toCamelCase)
    throw error
  }
  const json = await res.json()
  return transformKeys(json.data, toCamelCase) as T
}

export interface Statistics {
  admittedCount: number
  pendingOrdersCount: number
  pendingNursingCount: number
  alertCount: number
  criticalCount: number
  pendingMedTaskCount: number
}

export async function fetchStatistics(): Promise<Statistics> {
  return request<Statistics>('/hospitalizations/statistics')
}

export async function fetchHospitalizations(status?: string): Promise<Hospitalization[]> {
  const query = status ? `?status=${status}` : ''
  return request<Hospitalization[]>(`/hospitalizations${query}`)
}

export async function fetchHospitalizationDetail(id: string): Promise<HospitalizationDetail> {
  return request<HospitalizationDetail>(`/hospitalizations/${id}`)
}

export async function createHospitalization(data: Partial<Hospitalization>): Promise<Hospitalization> {
  return request<Hospitalization>('/hospitalizations', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateHospitalization(id: string, data: Partial<Hospitalization>): Promise<Hospitalization> {
  return request<Hospitalization>(`/hospitalizations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function dischargeHospitalization(id: string): Promise<Hospitalization> {
  return request<Hospitalization>(`/hospitalizations/${id}/discharge`, {
    method: 'POST',
  })
}

export async function markCritical(hospitalizationId: string, markedBy: string): Promise<Hospitalization> {
  return request<Hospitalization>(`/hospitalizations/${hospitalizationId}/critical`, {
    method: 'POST',
    body: JSON.stringify({ markedBy }),
  })
}

export async function unmarkCritical(hospitalizationId: string): Promise<Hospitalization> {
  return request<Hospitalization>(`/hospitalizations/${hospitalizationId}/critical`, {
    method: 'DELETE',
  })
}

export async function fetchCriticalObservations(hospitalizationId: string): Promise<CriticalObservation[]> {
  return request<CriticalObservation[]>(`/hospitalizations/${hospitalizationId}/critical-observations`)
}

export async function createCriticalObservation(hospitalizationId: string, data: Partial<CriticalObservation>): Promise<CriticalObservation> {
  return request<CriticalObservation>(`/hospitalizations/${hospitalizationId}/critical-observations`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function supplementCriticalObservation(
  hospitalizationId: string,
  data: Partial<CriticalObservation> & { supplementForShiftId: string }
): Promise<CriticalObservation> {
  return request<CriticalObservation>(`/hospitalizations/${hospitalizationId}/critical-observations/supplement`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function fetchHospitalMedicationTasks(hospitalizationId: string, status?: string): Promise<MedicationTask[]> {
  const query = status ? `?status=${status}` : ''
  return request<MedicationTask[]>(`/hospitalizations/${hospitalizationId}/medication-tasks${query}`)
}

export async function fetchOrders(hospitalizationId: string): Promise<Order[]> {
  return request<Order[]>(`/hospitalizations/${hospitalizationId}/orders`)
}

export async function createOrder(hospitalizationId: string, data: Partial<Order>): Promise<Order> {
  return request<Order>(`/hospitalizations/${hospitalizationId}/orders`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateOrder(orderId: string, data: Partial<Order>): Promise<Order> {
  return request<Order>(`/hospitalizations/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function confirmOrder(orderId: string, confirmedBy: string, stockQuantity?: number): Promise<Order & { medicationTask?: MedicationTask }> {
  return request<Order & { medicationTask?: MedicationTask }>(`/hospitalizations/orders/${orderId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ confirmedBy, stockQuantity }),
  })
}

export async function stopOrder(orderId: string, reason?: string): Promise<Order> {
  return request<Order>(`/hospitalizations/orders/${orderId}/stop`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function checkOrderStock(
  orderId: string,
  medicationName: string,
  requiredQuantity: number,
  stockQuantity: number
): Promise<{ sufficient: boolean; task: MedicationTask | null }> {
  return request(`/hospitalizations/orders/${orderId}/check-stock`, {
    method: 'POST',
    body: JSON.stringify({
      medicationName,
      requiredQuantity,
      stockQuantity,
    }),
  })
}

export async function fetchMedicationTasks(status?: string): Promise<MedicationTask[]> {
  const query = status ? `?status=${status}` : ''
  return request<MedicationTask[]>(`/hospitalizations/medication-tasks${query}`)
}

export async function fetchMedicationTask(taskId: string): Promise<MedicationTask> {
  return request<MedicationTask>(`/hospitalizations/medication-tasks/${taskId}`)
}

export async function updateMedicationTask(taskId: string, data: Partial<MedicationTask>): Promise<MedicationTask> {
  return request<MedicationTask>(`/hospitalizations/medication-tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function completeMedicationTask(taskId: string, notes?: string): Promise<MedicationTask> {
  return request<MedicationTask>(`/hospitalizations/medication-tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  })
}

export async function fetchNursingRecords(hospitalizationId: string): Promise<NursingRecord[]> {
  return request<NursingRecord[]>(`/hospitalizations/${hospitalizationId}/nursing-records`)
}

export async function createNursingRecord(hospitalizationId: string, data: Partial<NursingRecord>): Promise<NursingRecord> {
  return request<NursingRecord>(`/hospitalizations/${hospitalizationId}/nursing-records`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateNursingRecord(recordId: string, data: Partial<NursingRecord>): Promise<NursingRecord> {
  return request<NursingRecord>(`/hospitalizations/nursing-records/${recordId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function terminateNursingRecord(recordId: string, reason: string, terminationCategory?: string): Promise<NursingRecord> {
  return request<NursingRecord>(`/hospitalizations/nursing-records/${recordId}/terminate`, {
    method: 'POST',
    body: JSON.stringify({ reason, terminationCategory }),
  })
}

export async function fetchCurrentShift(): Promise<Shift & { nursingRecords: NursingRecord[] }> {
  return request<Shift & { nursingRecords: NursingRecord[] }>('/shifts/current')
}

export async function fetchHandoverChecklist(shiftId: string): Promise<HandoverChecklist> {
  return request<HandoverChecklist>(`/shifts/${shiftId}/handover-checklist`)
}

export async function handoverShift(data: {
  nurseOffDuty: string
  nurseOnDuty: string
  handoverNotes: string
  forceHandover?: boolean
}): Promise<Shift> {
  return request<Shift>('/shifts/handover', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function fetchShiftSummary(shiftId: string): Promise<{
  shift: Shift
  totalRecords: number
  abnormalRecords: NursingRecord[]
  activeOrdersCount: number
  nursingRecords: NursingRecord[]
}> {
  return request(`/shifts/${shiftId}/summary`)
}

export async function fetchBilling(hospitalizationId: string): Promise<BillingItem[]> {
  return request<BillingItem[]>(`/hospitalizations/${hospitalizationId}/billing`)
}

export async function createBillingItem(hospitalizationId: string, data: Partial<BillingItem>): Promise<BillingItem> {
  return request<BillingItem>(`/hospitalizations/${hospitalizationId}/billing`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function terminateBillingItem(itemId: string, reason: string, terminationCategory?: string): Promise<BillingItem> {
  return request<BillingItem>(`/hospitalizations/billing/${itemId}/terminate`, {
    method: 'POST',
    body: JSON.stringify({ reason, terminationCategory }),
  })
}

export async function fetchDischargeClosureSummary(hospitalizationId: string): Promise<DischargeClosureSummary> {
  return request<DischargeClosureSummary>(`/hospitalizations/${hospitalizationId}/closure-summary`)
}

export async function settleBilling(
  hospitalizationId: string,
  earlyDischargeReason?: string
): Promise<{
  hospitalization: Hospitalization
  billingSummary: {
    totalAmount: number
    depositAmount: number
    depositUsed: number
    remainingAmount: number
    itemsCount: number
  }
  closureSummary: DischargeClosureSummary
}> {
  return request(`/hospitalizations/${hospitalizationId}/settle`, {
    method: 'POST',
    body: JSON.stringify({ earlyDischargeReason }),
  })
}

export async function fetchStaff(): Promise<Staff[]> {
  return request<Staff[]>('/staff')
}
