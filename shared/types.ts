export interface Hospitalization {
  id: string
  petName: string
  petType: string
  breed: string
  age: number
  weight: number
  ownerName: string
  ownerPhone: string
  vaccineStatus: 'complete' | 'incomplete' | 'unknown'
  isolationRequired: boolean
  depositAmount: number
  depositUsed: number
  authSurgery: boolean
  authTransfusion: boolean
  authSpecialExam: boolean
  status: 'admitted' | 'discharged'
  isCritical: boolean
  criticalMarkedBy: string | null
  criticalMarkedAt: string | null
  admittingVetId: string
  admittingNurseId: string
  cageNumber: string
  admissionDate: string
  dischargeDate: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  hospitalizationId: string
  vetId: string
  type: 'long_term' | 'temporary' | 'pending_confirm'
  category: 'medication' | 'observation' | 'care' | 'examination'
  content: string
  dosage: string
  frequency: string
  startDate: string
  endDate: string | null
  confirmed: boolean
  confirmedBy: string | null
  confirmedAt: string | null
  status: 'active' | 'stopped' | 'completed'
  medicationName: string | null
  medicationQuantity: number
  medicationStockAvailable: number
  stockChecked: boolean
  changeReason: string | null
  createdAt: string
  updatedAt: string
}

export interface NursingRecord {
  id: string
  hospitalizationId: string
  orderId: string
  nurseId: string
  executedAt: string
  result: 'normal' | 'abnormal' | 'refused'
  observation: string
  abnormalNote: string | null
  handoverNote: string | null
  shiftId: string
  status: 'completed' | 'terminated'
  terminatedReason: string | null
  terminatedAt: string | null
  terminationCategory: 'early_discharge' | 'clinical_decision' | 'other' | null
  createdAt: string
}

export interface BillingItem {
  id: string
  hospitalizationId: string
  category: 'hospitalization' | 'medication' | 'nursing' | 'examination' | 'other'
  name: string
  amount: number
  quantity: number
  totalAmount: number
  status: 'completed' | 'terminated'
  orderId: string | null
  nursingRecordId: string | null
  terminatedReason: string | null
  terminatedAt: string | null
  terminationCategory: 'early_discharge' | 'clinical_decision' | 'other' | null
  createdAt: string
}

export interface BillingSummary {
  hospitalizationId: string
  totalAmount: number
  depositAmount: number
  depositUsed: number
  depositRemaining: number
  depositWarning: 'none' | 'low' | 'critical'
  items: BillingItem[]
  allNursingComplete: boolean
  incompleteRecords: string[]
}

export interface Shift {
  id: string
  nurseOnDuty: string
  nurseOffDuty: string | null
  startTime: string
  endTime: string | null
  handoverNotes: string
  status: 'active' | 'handed_over'
  createdAt: string
}

export interface Staff {
  id: string
  name: string
  role: string
  code: string
  createdAt: string
}

export interface CriticalObservation {
  id: string
  hospitalizationId: string
  shiftId: string
  nurseId: string
  temperature: number | null
  heartRate: number | null
  respiratoryRate: number | null
  bloodPressureSystolic: number | null
  bloodPressureDiastolic: number | null
  oxygenSaturation: number | null
  mentalStatus: string | null
  appetite: string | null
  clinicalSigns: string | null
  intervention: string | null
  notes: string | null
  isSupplement: boolean
  supplementForShiftId: string | null
  recordedAt: string
  createdAt: string
}

export interface MedicationTask {
  id: string
  hospitalizationId: string
  orderId: string
  medicationName: string
  requiredQuantity: number
  availableQuantity: number
  pendingQuantity: number
  status: 'pending' | 'completed' | 'cancelled'
  priority: 'normal' | 'urgent'
  assignedTo: string | null
  notes: string | null
  createdAt: string
  completedAt: string | null
}

export interface HandoverChecklistItem {
  type: string
  id: string
  name: string
  status: string
  message: string
}

export interface HandoverChecklist {
  criticalObservations: {
    criticalCount: number
    missingCount: number
    missingPets: { id: string; petName: string }[]
  }
  previousShiftMissing: {
    shiftId: string | null
    missingCount: number
    missingPets: { id: string; petName: string }[]
  }
  pendingOrders: {
    count: number
    items: any[]
  }
  pendingMedicationTasks: {
    count: number
    items: any[]
  }
  canHandover: boolean
}

export interface DischargeClosureSummary {
  hospitalization: Hospitalization
  summary: {
    orderCount: number
    nursingCompletedCount: number
    nursingTerminatedCount: number
    nursingEarlyDischargeCount: number
    nursingClinicalTerminatedCount: number
    billingCompletedCount: number
    billingTerminatedCount: number
    billingEarlyDischargeCount: number
    billingClinicalTerminatedCount: number
    pendingMedicationTaskCount: number
    unclosedItemCount: number
  }
  completedNursing: NursingRecord[]
  terminatedNursing: NursingRecord[]
  earlyDischargeNursing: NursingRecord[]
  clinicalTerminatedNursing: NursingRecord[]
  completedBilling: BillingItem[]
  terminatedBilling: BillingItem[]
  earlyDischargeBilling: BillingItem[]
  clinicalTerminatedBilling: BillingItem[]
  pendingMedicationTasks: MedicationTask[]
  unclosedItems: HandoverChecklistItem[]
  canDischarge: boolean
}

export interface HospitalizationDetail extends Hospitalization {
  orders: Order[]
  nursingRecords: NursingRecord[]
  billingItems: BillingItem[]
  criticalObservations: CriticalObservation[]
  medicationTasks: MedicationTask[]
}
