import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Lock, Clock, AlertTriangle, AlertCircle, HeartPulse, Plus, X } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import {
  fetchHospitalizationDetail, fetchOrders, fetchNursingRecords, createNursingRecord, fetchStaff,
  markCritical, unmarkCritical, fetchCriticalObservations, createCriticalObservation, fetchCurrentShift,
  supplementCriticalObservation,
} from '@/lib/api'
import type { HospitalizationDetail, Order, NursingRecord, CriticalObservation, Shift } from 'shared/types'

const CATEGORY_MAP: Record<Order['category'], string> = {
  medication: '药品', observation: '观察', care: '护理', examination: '检查',
}

const RESULT_MAP: Record<NursingRecord['result'], { label: string; cls: string }> = {
  normal: { label: '正常', cls: 'bg-green-100 text-green-700' },
  abnormal: { label: '异常', cls: 'bg-red-100 text-red-700' },
  refused: { label: '拒食', cls: 'bg-gray-100 text-gray-600' },
}

const VACCINE_MAP: Record<string, { label: string; cls: string }> = {
  complete: { label: '疫苗完整', cls: 'bg-green-100 text-green-700' },
  incomplete: { label: '疫苗不全', cls: 'bg-yellow-100 text-yellow-700' },
  unknown: { label: '疫苗未知', cls: 'bg-gray-100 text-gray-600' },
}

interface ExecForm {
  orderId: string; executedAt: string; result: NursingRecord['result']
  observation: string; abnormalNote: string; handoverNote: string
}

const emptyExec = (orderId: string): ExecForm => ({
  orderId, executedAt: new Date().toISOString().slice(0, 16),
  result: 'normal', observation: '', abnormalNote: '', handoverNote: '',
})

interface CriticalObsForm {
  temperature: string
  heartRate: string
  respiratoryRate: string
  bloodPressureSystolic: string
  bloodPressureDiastolic: string
  oxygenSaturation: string
  mentalStatus: string
  appetite: string
  clinicalSigns: string
  intervention: string
  notes: string
}

const emptyCriticalObs = (): CriticalObsForm => ({
  temperature: '', heartRate: '', respiratoryRate: '',
  bloodPressureSystolic: '', bloodPressureDiastolic: '', oxygenSaturation: '',
  mentalStatus: '', appetite: '', clinicalSigns: '', intervention: '', notes: '',
})

export default function Nursing() {
  const { id } = useParams<{ id: string }>()
  const { currentRole, currentStaff, staffList, setStaffList } = useAppStore()
  const [detail, setDetail] = useState<HospitalizationDetail | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [records, setRecords] = useState<NursingRecord[]>([])
  const [criticalObservations, setCriticalObservations] = useState<CriticalObservation[]>([])
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<ExecForm | null>(null)
  const [criticalForm, setCriticalForm] = useState<CriticalObsForm | null>(null)
  const [supplementTargetShiftId, setSupplementTargetShiftId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const loadData = useCallback(async () => {
    if (!id) return
    const [d, o, r, s, co] = await Promise.all([
      fetchHospitalizationDetail(id), fetchOrders(id), fetchNursingRecords(id),
      staffList.length === 0 ? fetchStaff() : Promise.resolve(staffList),
      fetchCriticalObservations(id),
    ])
    setDetail(d); setOrders(o); setRecords(r); setCriticalObservations(co)
    if (Array.isArray(s) && s.length > 0) setStaffList(s)
    const sh = await fetchCurrentShift().catch(() => null)
    if (sh) setCurrentShift(sh)
  }, [id, staffList, setStaffList])

  useEffect(() => { loadData() }, [loadData])

  const canExecute = currentRole === 'nurse' || currentRole === 'vet'
  const h = detail

  const today = new Date().toISOString().slice(0, 10)
  const todayRecords = records
    .filter((r) => r.executedAt?.slice(0, 10) === today)
    .sort((a, b) => a.executedAt.localeCompare(b.executedAt))

  const activeOrders = orders.filter((o) => o.status === 'active')
  const executedOrderIds = new Set(todayRecords.map((r) => r.orderId))
  const pendingOrders = activeOrders.map((o) => ({
    ...o,
    executedToday: executedOrderIds.has(o.id),
    needsConfirm: o.type === 'pending_confirm' && !o.confirmed,
  }))

  const now = new Date()
  const isOverdue = (o: Order) => {
    if (!o.frequency) return false
    return now.getHours() >= 20
  }

  const handleSelect = (o: typeof pendingOrders[number]) => {
    if (o.needsConfirm) {
      setToast('需兽医先确认此医嘱')
      setTimeout(() => setToast(''), 2500)
      return
    }
    if (o.executedToday) return
    setSelectedId(o.id)
    setForm(emptyExec(o.id))
  }

  const handleSubmit = async () => {
    if (!id || !form) return
    const nurseId = currentStaff?.id || staffList.find(s => s.role === 'nurse')?.id
    if (!nurseId) return
    await createNursingRecord(id, {
      orderId: form.orderId, nurseId,
      executedAt: form.executedAt, result: form.result,
      observation: form.observation,
      abnormalNote: form.result === 'abnormal' ? form.abnormalNote : null,
      handoverNote: form.handoverNote || null,
    })
    setSelectedId(null); setForm(null); loadData()
  }

  const handleMarkCritical = async () => {
    if (!id) return
    const vetId = currentStaff?.id || staffList.find(s => s.role === 'vet')?.id
    if (!vetId) { setToast('需兽医标记重症'); setTimeout(() => setToast(''), 2500); return }
    await markCritical(id, vetId)
    loadData()
  }

  const handleUnmarkCritical = async () => {
    if (!id) return
    await unmarkCritical(id)
    loadData()
  }

  const handleCriticalObsSubmit = async () => {
    if (!id || !criticalForm || !currentShift) return
    const nurseId = currentStaff?.id || staffList.find(s => s.role === 'nurse')?.id
    if (!nurseId) { setToast('需护士记录'); setTimeout(() => setToast(''), 2500); return }

    if (supplementTargetShiftId) {
      await supplementCriticalObservation(id, {
        shiftId: currentShift.id,
        nurseId,
        supplementForShiftId: supplementTargetShiftId,
        temperature: criticalForm.temperature ? parseFloat(criticalForm.temperature) : null,
        heartRate: criticalForm.heartRate ? parseInt(criticalForm.heartRate) : null,
        respiratoryRate: criticalForm.respiratoryRate ? parseInt(criticalForm.respiratoryRate) : null,
        bloodPressureSystolic: criticalForm.bloodPressureSystolic ? parseInt(criticalForm.bloodPressureSystolic) : null,
        bloodPressureDiastolic: criticalForm.bloodPressureDiastolic ? parseInt(criticalForm.bloodPressureDiastolic) : null,
        oxygenSaturation: criticalForm.oxygenSaturation ? parseFloat(criticalForm.oxygenSaturation) : null,
        mentalStatus: criticalForm.mentalStatus || null,
        appetite: criticalForm.appetite || null,
        clinicalSigns: criticalForm.clinicalSigns || null,
        intervention: criticalForm.intervention || null,
        notes: criticalForm.notes || null,
      })
      setSupplementTargetShiftId(null)
    } else {
      await createCriticalObservation(id, {
        shiftId: currentShift.id,
        nurseId,
        temperature: criticalForm.temperature ? parseFloat(criticalForm.temperature) : null,
        heartRate: criticalForm.heartRate ? parseInt(criticalForm.heartRate) : null,
        respiratoryRate: criticalForm.respiratoryRate ? parseInt(criticalForm.respiratoryRate) : null,
        bloodPressureSystolic: criticalForm.bloodPressureSystolic ? parseInt(criticalForm.bloodPressureSystolic) : null,
        bloodPressureDiastolic: criticalForm.bloodPressureDiastolic ? parseInt(criticalForm.bloodPressureDiastolic) : null,
        oxygenSaturation: criticalForm.oxygenSaturation ? parseFloat(criticalForm.oxygenSaturation) : null,
        mentalStatus: criticalForm.mentalStatus || null,
        appetite: criticalForm.appetite || null,
        clinicalSigns: criticalForm.clinicalSigns || null,
        intervention: criticalForm.intervention || null,
        notes: criticalForm.notes || null,
      })
    }
    setCriticalForm(null); loadData()
  }

  const todayCriticalObs = criticalObservations.filter(
    (o) => o.recordedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)
  )

  const shiftObsRecorded = currentShift && criticalObservations.some(
    (o) => o.shiftId === currentShift.id
  )

  const petBar = h && (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-white px-5 py-3 text-sm shadow-sm">
      <span className="font-semibold text-slate-800">{h.petName}</span>
      <span className="text-slate-500">{h.petType} · {h.breed}</span>
      <span className="text-slate-500">笼号 {h.cageNumber}</span>
      <span className="text-slate-500">主人 {h.ownerName}</span>
      <span className="text-slate-500">入院 {h.admissionDate?.slice(0, 10)}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${VACCINE_MAP[h.vaccineStatus]?.cls}`}>
        {VACCINE_MAP[h.vaccineStatus]?.label}
      </span>
      {h.isCritical ? (
        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
          <HeartPulse size={12} fill="currentColor" />重症监护
        </span>
      ) : null}
      {h.status === 'admitted' && (canExecute || currentRole === 'vet') && (
        h.isCritical ? (
          <button onClick={handleUnmarkCritical}
            className="ml-auto rounded-md bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200">
            取消重症标记
          </button>
        ) : (
          <button onClick={handleMarkCritical}
            className="ml-auto flex items-center gap-1 rounded-md bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100">
            <HeartPulse size={12} />标记为重症
          </button>
        )
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <nav className="text-sm text-slate-500">
        <Link to="/" className="hover:text-blue-600">工作台</Link>
        <span className="mx-1.5">&gt;</span>
        <span>护理执行</span>
        {h && <><span className="mx-1.5">&gt;</span><span className="text-slate-800">{h.petName}</span></>}
      </nav>

      {petBar}

      {toast && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{toast}</div>
      )}

      <div className="flex gap-4">
        <div className="w-[380px] shrink-0 space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">待执行医嘱</h3>
          {pendingOrders.length === 0 && (
            <div className="rounded-lg bg-white px-4 py-8 text-center text-sm text-slate-400 shadow-sm">暂无待执行医嘱</div>
          )}
          {pendingOrders.map((o) => {
            const locked = o.needsConfirm
            const done = o.executedToday
            const overdue = !done && !locked && isOverdue(o)
            const selected = selectedId === o.id
            return (
              <div key={o.id} onClick={() => handleSelect(o)}
                className={`relative cursor-pointer rounded-lg bg-white px-4 py-3 shadow-sm transition-colors
                  ${done ? 'opacity-60' : 'hover:bg-blue-50'}
                  ${selected ? 'ring-2 ring-blue-500' : ''}
                  ${locked ? 'cursor-not-allowed' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {o.content}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {CATEGORY_MAP[o.category]}{o.frequency ? ` · ${o.frequency}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {done && <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">已执行</span>}
                    {overdue && (
                      <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        <Clock size={12} />超时
                      </span>
                    )}
                  </div>
                </div>
                {locked && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                      <Lock size={14} />需兽医确认
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex-1">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">执行记录</h3>
          {form && canExecute ? (
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <div className="space-y-4">
                <label>
                  <span className="mb-1 block text-xs text-slate-500">执行时间</span>
                  <input type="datetime-local" value={form.executedAt}
                    onChange={(e) => setForm({ ...form, executedAt: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-slate-500">执行结果</span>
                  <select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value as NursingRecord['result'] })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="normal">正常</option>
                    <option value="abnormal">异常</option>
                    <option value="refused">拒食</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs text-slate-500">观察记录</span>
                  <textarea value={form.observation} onChange={(e) => setForm({ ...form, observation: e.target.value })} rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </label>
                {form.result === 'abnormal' && (
                  <label>
                    <span className="mb-1 block text-xs text-red-500">异常描述 *</span>
                    <textarea value={form.abnormalNote} onChange={(e) => setForm({ ...form, abnormalNote: e.target.value })} rows={2}
                      className="w-full rounded-lg border-2 border-red-400 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" placeholder="请描述异常情况" />
                  </label>
                )}
                <label>
                  <span className="mb-1 block text-xs text-slate-500">交接班备注（可选）</span>
                  <textarea value={form.handoverNote} onChange={(e) => setForm({ ...form, handoverNote: e.target.value })} rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </label>
              </div>
              <div className="mt-5 flex justify-end">
                <button onClick={handleSubmit}
                  disabled={form.result === 'abnormal' && !form.abnormalNote}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  提交
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-lg bg-white text-sm text-slate-400 shadow-sm">
              {!canExecute ? '无执行权限' : '请选择左侧待执行医嘱'}
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">今日护理记录</h3>
        {todayRecords.length === 0 ? (
          <div className="rounded-lg bg-white px-4 py-6 text-center text-sm text-slate-400 shadow-sm">暂无记录</div>
        ) : (
          <div className="relative ml-4 border-l-2 border-slate-200 pl-6">
            {todayRecords.map((r) => {
              const order = orders.find((o) => o.id === r.orderId)
              const isAbnormal = r.result === 'abnormal'
              return (
                <div key={r.id} className="relative mb-4 last:mb-0">
                  <div className="absolute -left-[1.85rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
                  <div className={`rounded-lg bg-white p-4 shadow-sm ${isAbnormal ? 'border-l-4 border-l-red-500' : ''}`}>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500">{r.executedAt?.slice(11, 16)}</span>
                      <span className="font-medium text-slate-800">{order?.content || '未知医嘱'}</span>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${RESULT_MAP[r.result]?.cls}`}>
                        {RESULT_MAP[r.result]?.label}
                      </span>
                      {r.status === 'terminated' && (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">已终止</span>
                      )}
                    </div>
                    {r.observation && (
                      <p className="mt-1.5 text-xs text-slate-500">{r.observation}</p>
                    )}
                    {isAbnormal && r.abnormalNote && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                        <AlertTriangle size={12} />{r.abnormalNote}
                      </p>
                    )}
                    {r.status === 'terminated' && r.terminatedReason && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                        <X size={12} />终止原因：{r.terminatedReason}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {h?.isCritical && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <HeartPulse size={14} className="text-red-600" />重症观察记录
            </h3>
            <div className="flex items-center gap-2">
              {!shiftObsRecorded && h.status === 'admitted' && (
                <span className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle size={12} />本班次未记录
                </span>
              )}
              {shiftObsRecorded && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  本班次已记录
                </span>
              )}
              {canExecute && !shiftObsRecorded && h.status === 'admitted' && !criticalForm && (
                <button onClick={() => { setSupplementTargetShiftId(null); setCriticalForm(emptyCriticalObs()) }}
                  className="flex items-center gap-1 rounded-md bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700">
                  <Plus size={12} />添加本班观察
                </button>
              )}
            </div>
          </div>

          {criticalForm && (
            <div className="rounded-lg bg-white p-4 shadow-sm mb-4">
              <div className="mb-3 flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-800">
                  {supplementTargetShiftId ? '补录观察记录' : '新增观察记录'}
                </h4>
                {supplementTargetShiftId && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">补录</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <label>
                  <span className="mb-1 block text-xs text-slate-500">体温 (°C)</span>
                  <input type="number" step="0.1" value={criticalForm.temperature}
                    onChange={(e) => setCriticalForm({ ...criticalForm, temperature: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-slate-500">心率 (次/分)</span>
                  <input type="number" value={criticalForm.heartRate}
                    onChange={(e) => setCriticalForm({ ...criticalForm, heartRate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-slate-500">呼吸 (次/分)</span>
                  <input type="number" value={criticalForm.respiratoryRate}
                    onChange={(e) => setCriticalForm({ ...criticalForm, respiratoryRate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-slate-500">收缩压 (mmHg)</span>
                  <input type="number" value={criticalForm.bloodPressureSystolic}
                    onChange={(e) => setCriticalForm({ ...criticalForm, bloodPressureSystolic: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-slate-500">舒张压 (mmHg)</span>
                  <input type="number" value={criticalForm.bloodPressureDiastolic}
                    onChange={(e) => setCriticalForm({ ...criticalForm, bloodPressureDiastolic: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-slate-500">血氧饱和度 (%)</span>
                  <input type="number" step="0.1" value={criticalForm.oxygenSaturation}
                    onChange={(e) => setCriticalForm({ ...criticalForm, oxygenSaturation: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-slate-500">精神状态</span>
                  <select value={criticalForm.mentalStatus}
                    onChange={(e) => setCriticalForm({ ...criticalForm, mentalStatus: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">请选择</option>
                    <option value="alert">清醒警觉</option>
                    <option value="depressed">精神沉郁</option>
                    <option value="obtunded">迟钝</option>
                    <option value="stupor">昏睡</option>
                    <option value="comatose">昏迷</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs text-slate-500">食欲</span>
                  <select value={criticalForm.appetite}
                    onChange={(e) => setCriticalForm({ ...criticalForm, appetite: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">请选择</option>
                    <option value="good">正常</option>
                    <option value="reduced">减少</option>
                    <option value="poor">差</option>
                    <option value="none">绝食</option>
                  </select>
                </label>
              </div>
              <div className="space-y-3">
                <label>
                  <span className="mb-1 block text-xs text-slate-500">临床症状</span>
                  <textarea value={criticalForm.clinicalSigns}
                    onChange={(e) => setCriticalForm({ ...criticalForm, clinicalSigns: e.target.value })} rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="描述观察到的症状" />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-slate-500">处置措施</span>
                  <textarea value={criticalForm.intervention}
                    onChange={(e) => setCriticalForm({ ...criticalForm, intervention: e.target.value })} rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="已采取的治疗/护理措施" />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-slate-500">备注</span>
                  <textarea value={criticalForm.notes}
                    onChange={(e) => setCriticalForm({ ...criticalForm, notes: e.target.value })} rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setCriticalForm(null)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200">
                  取消
                </button>
                <button onClick={handleCriticalObsSubmit}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">
                  提交观察记录
                </button>
              </div>
            </div>
          )}

          {criticalObservations.length === 0 && !criticalForm ? (
            <div className="rounded-lg bg-white px-4 py-6 text-center text-sm text-slate-400 shadow-sm">暂无重症观察记录</div>
          ) : (
            <div className="space-y-2">
              {criticalObservations
                .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
                .map((obs) => {
                  const nurse = staffList.find((s) => s.id === obs.nurseId)
                  return (
                    <div key={obs.id} className={`rounded-lg bg-white p-4 shadow-sm border-l-4 ${obs.isSupplement ? 'border-l-amber-400' : 'border-l-red-400'}`}>
                      <div className="flex items-center gap-3 text-sm mb-2">
                        <span className="text-slate-500">{obs.recordedAt?.slice(0, 16)}</span>
                        <span className="font-medium text-slate-700">记录人：{nurse?.name || '未知'}</span>
                        {obs.isSupplement && (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">补录</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-xs">
                        {obs.temperature != null && (
                          <span><span className="text-slate-500">体温：</span><span className="text-slate-800">{obs.temperature}°C</span></span>
                        )}
                        {obs.heartRate != null && (
                          <span><span className="text-slate-500">心率：</span><span className="text-slate-800">{obs.heartRate} 次/分</span></span>
                        )}
                        {obs.respiratoryRate != null && (
                          <span><span className="text-slate-500">呼吸：</span><span className="text-slate-800">{obs.respiratoryRate} 次/分</span></span>
                        )}
                        {obs.bloodPressureSystolic != null && obs.bloodPressureDiastolic != null && (
                          <span><span className="text-slate-500">血压：</span><span className="text-slate-800">{obs.bloodPressureSystolic}/{obs.bloodPressureDiastolic} mmHg</span></span>
                        )}
                        {obs.oxygenSaturation != null && (
                          <span><span className="text-slate-500">血氧：</span><span className="text-slate-800">{obs.oxygenSaturation}%</span></span>
                        )}
                        {obs.mentalStatus && (
                          <span><span className="text-slate-500">精神：</span><span className="text-slate-800">
                            {({ alert: '清醒警觉', depressed: '精神沉郁', obtunded: '迟钝', stupor: '昏睡', comatose: '昏迷' } as Record<string, string>)[obs.mentalStatus] || obs.mentalStatus}
                          </span></span>
                        )}
                        {obs.appetite && (
                          <span><span className="text-slate-500">食欲：</span><span className="text-slate-800">
                            {({ good: '正常', reduced: '减少', poor: '差', none: '绝食' } as Record<string, string>)[obs.appetite] || obs.appetite}
                          </span></span>
                        )}
                      </div>
                      <div className="mt-2 space-y-1 text-xs">
                        {obs.clinicalSigns && <p><span className="text-slate-500">症状：</span><span className="text-slate-700">{obs.clinicalSigns}</span></p>}
                        {obs.intervention && <p><span className="text-slate-500">处置：</span><span className="text-slate-700">{obs.intervention}</span></p>}
                        {obs.notes && <p><span className="text-slate-500">备注：</span><span className="text-slate-700">{obs.notes}</span></p>}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
