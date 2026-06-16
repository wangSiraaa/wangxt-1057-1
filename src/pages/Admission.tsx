import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronRight, AlertCircle } from 'lucide-react'
import {
  fetchHospitalizationDetail,
  createHospitalization,
  updateHospitalization,
} from '@/lib/api'
import { useAppStore } from '@/store/appStore'
import type { Hospitalization } from 'shared/types'

const PET_TYPES = [
  { value: '猫', label: '猫' },
  { value: '狗', label: '狗' },
  { value: '兔', label: '兔' },
  { value: '其他', label: '其他' },
]

const VACCINE_OPTIONS = [
  { value: 'complete', label: '完整' },
  { value: 'incomplete', label: '缺失' },
  { value: 'unknown', label: '未知' },
]

const emptyForm = (): FormState => ({
  petName: '',
  petType: '猫',
  breed: '',
  age: 0,
  weight: 0,
  cageNumber: '',
  ownerName: '',
  ownerPhone: '',
  notes: '',
  vaccineStatus: 'unknown',
  isolationRequired: false,
  depositAmount: 0,
  authSurgery: false,
  authTransfusion: false,
  authSpecialExam: false,
})

interface FormState {
  petName: string
  petType: string
  breed: string
  age: number
  weight: number
  cageNumber: string
  ownerName: string
  ownerPhone: string
  notes: string
  vaccineStatus: Hospitalization['vaccineStatus']
  isolationRequired: boolean
  depositAmount: number
  authSurgery: boolean
  authTransfusion: boolean
  authSpecialExam: boolean
}

export default function Admission() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setIsLoading } = useAppStore()

  const isNew = !id || id === 'new'
  const [form, setForm] = useState<FormState>(emptyForm)
  const [readonly, setReadonly] = useState(false)
  const [showVaccineTip, setShowVaccineTip] = useState(false)
  const [depositRemaining, setDepositRemaining] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isNew && id) {
      loadDetail(id)
    }
  }, [id])

  async function loadDetail(hid: string) {
    setIsLoading(true)
    try {
      const detail = await fetchHospitalizationDetail(hid)
      setForm({
        petName: detail.petName,
        petType: detail.petType,
        breed: detail.breed,
        age: detail.age,
        weight: detail.weight,
        cageNumber: detail.cageNumber,
        ownerName: detail.ownerName,
        ownerPhone: detail.ownerPhone,
        notes: detail.notes,
        vaccineStatus: detail.vaccineStatus,
        isolationRequired: detail.isolationRequired,
        depositAmount: detail.depositAmount,
        authSurgery: detail.authSurgery,
        authTransfusion: detail.authTransfusion,
        authSpecialExam: detail.authSpecialExam,
      })
      setDepositRemaining(detail.depositAmount - detail.depositUsed)
      if (detail.vaccineStatus === 'incomplete') setShowVaccineTip(true)
      if (detail.status === 'discharged') setReadonly(true)
    } finally {
      setIsLoading(false)
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'vaccineStatus') {
        const isIncomplete = value === 'incomplete'
        setShowVaccineTip(isIncomplete)
        if (isIncomplete) next.isolationRequired = true
      }
      return next
    })
  }

  async function handleSave() {
    if (!form.petName || !form.ownerName) {
      alert('请填写宠物名和主人姓名')
      return
    }
    setSaving(true)
    try {
      const payload: Partial<Hospitalization> = {
        petName: form.petName,
        petType: form.petType,
        breed: form.breed,
        age: form.age,
        weight: form.weight,
        cageNumber: form.cageNumber,
        ownerName: form.ownerName,
        ownerPhone: form.ownerPhone,
        notes: form.notes,
        vaccineStatus: form.vaccineStatus,
        isolationRequired: form.isolationRequired,
        depositAmount: form.depositAmount,
        authSurgery: form.authSurgery,
        authTransfusion: form.authTransfusion,
        authSpecialExam: form.authSpecialExam,
        admissionDate: new Date().toISOString().slice(0, 10),
      }
      if (isNew) {
        await createHospitalization(payload)
      } else if (id) {
        await updateHospitalization(id, payload)
      }
      navigate('/')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400'

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <nav className="flex items-center gap-1 text-sm text-slate-500">
        <button onClick={() => navigate('/')} className="hover:text-blue-500">
          工作台
        </button>
        <ChevronRight size={14} />
        <span>住院登记</span>
        {!isNew && form.petName && (
          <>
            <ChevronRight size={14} />
            <span className="text-slate-700">{form.petName}</span>
          </>
        )}
      </nav>

      <Card title="宠物基本信息">
        <div className="grid grid-cols-3 gap-4">
          <Field label="宠物名">
            <input
              className={inputCls}
              value={form.petName}
              onChange={(e) => updateField('petName', e.target.value)}
              readOnly={readonly}
            />
          </Field>
          <Field label="种类">
            <select
              className={inputCls}
              value={form.petType}
              onChange={(e) => updateField('petType', e.target.value)}
              disabled={readonly}
            >
              {PET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="品种">
            <input
              className={inputCls}
              value={form.breed}
              onChange={(e) => updateField('breed', e.target.value)}
              readOnly={readonly}
            />
          </Field>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Field label="年龄">
            <input
              type="number"
              className={inputCls}
              value={form.age || ''}
              onChange={(e) =>
                updateField('age', Number(e.target.value))
              }
              readOnly={readonly}
            />
          </Field>
          <Field label="体重 (kg)">
            <input
              type="number"
              className={inputCls}
              value={form.weight || ''}
              onChange={(e) =>
                updateField('weight', Number(e.target.value))
              }
              readOnly={readonly}
            />
          </Field>
          <Field label="笼号">
            <input
              className={inputCls}
              value={form.cageNumber}
              onChange={(e) => updateField('cageNumber', e.target.value)}
              readOnly={readonly}
            />
          </Field>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Field label="主人姓名">
            <input
              className={inputCls}
              value={form.ownerName}
              onChange={(e) => updateField('ownerName', e.target.value)}
              readOnly={readonly}
            />
          </Field>
          <Field label="联系电话">
            <input
              className={inputCls}
              value={form.ownerPhone}
              onChange={(e) => updateField('ownerPhone', e.target.value)}
              readOnly={readonly}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="备注">
            <textarea
              className={inputCls + ' resize-none'}
              rows={3}
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              readOnly={readonly}
            />
          </Field>
        </div>
      </Card>

      <Card title="疫苗与隔离">
        <div className="grid grid-cols-2 gap-4">
          <Field label="疫苗状态">
            <select
              className={inputCls}
              value={form.vaccineStatus}
              onChange={(e) =>
                updateField(
                  'vaccineStatus',
                  e.target.value as Hospitalization['vaccineStatus'],
                )
              }
              disabled={readonly}
            >
              {VACCINE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="隔离护理">
            <label className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={form.isolationRequired}
                onChange={(e) =>
                  updateField('isolationRequired', e.target.checked)
                }
                disabled={readonly}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">需隔离护理</span>
            </label>
          </Field>
        </div>
        {showVaccineTip && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-orange-50 px-4 py-2.5 text-sm text-orange-700">
            <AlertCircle size={16} className="shrink-0" />
            疫苗状态缺失，已自动标记为隔离护理
          </div>
        )}
      </Card>

      <Card title="押金与授权">
        <div className="grid grid-cols-2 gap-4">
          <Field label="押金金额">
            <input
              type="number"
              className={inputCls}
              value={form.depositAmount || ''}
              onChange={(e) =>
                updateField('depositAmount', Number(e.target.value))
              }
              readOnly={readonly}
            />
          </Field>
          {!isNew && (
            <Field label="押金余额">
              <div className="flex h-[38px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                ¥{depositRemaining.toFixed(2)}
              </div>
            </Field>
          )}
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-xs text-slate-500">主人授权</p>
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.authSurgery}
                onChange={(e) =>
                  updateField('authSurgery', e.target.checked)
                }
                disabled={readonly}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">手术授权</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.authTransfusion}
                onChange={(e) =>
                  updateField('authTransfusion', e.target.checked)
                }
                disabled={readonly}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">输血授权</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.authSpecialExam}
                onChange={(e) =>
                  updateField('authSpecialExam', e.target.checked)
                }
                disabled={readonly}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">特殊检查授权</span>
            </label>
          </div>
        </div>
      </Card>

      {!readonly && (
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg border border-slate-300 bg-white px-6 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-500 px-6 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      )}
    </div>
  )
}

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="flex">
        <div className="w-1 shrink-0 bg-blue-500" />
        <div className="flex-1 p-5">
          <h3 className="mb-4 text-sm font-bold text-blue-600">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-400">{label}</label>
      {children}
    </div>
  )
}
