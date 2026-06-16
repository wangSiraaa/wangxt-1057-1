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

export interface HospitalizationDetail extends Hospitalization {
  orders: Order[]
  nursingRecords: NursingRecord[]
  billingItems: BillingItem[]
}
