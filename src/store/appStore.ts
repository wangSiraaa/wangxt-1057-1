import { create } from 'zustand'
import type { Hospitalization, HospitalizationDetail, Staff } from 'shared/types'

interface AppState {
  currentRole: string
  setCurrentRole: (role: string) => void
  currentStaff: Staff | null
  setCurrentStaff: (staff: Staff | null) => void
  staffList: Staff[]
  setStaffList: (list: Staff[]) => void
  hospitalizations: Hospitalization[]
  setHospitalizations: (list: Hospitalization[]) => void
  selectedHospitalization: HospitalizationDetail | null
  setSelectedHospitalization: (detail: HospitalizationDetail | null) => void
  alerts: string[]
  addAlert: (alert: string) => void
  removeAlert: (alert: string) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentRole: 'nurse',
  setCurrentRole: (role) => set({ currentRole: role }),
  currentStaff: null,
  setCurrentStaff: (staff) => set({ currentStaff: staff }),
  staffList: [],
  setStaffList: (list) => set({ staffList: list }),
  hospitalizations: [],
  setHospitalizations: (list) => set({ hospitalizations: list }),
  selectedHospitalization: null,
  setSelectedHospitalization: (detail) => set({ selectedHospitalization: detail }),
  alerts: [],
  addAlert: (alert) => set((state) => ({ alerts: [...state.alerts, alert] })),
  removeAlert: (alert) => set((state) => ({
    alerts: state.alerts.filter((a) => a !== alert),
  })),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
}))
