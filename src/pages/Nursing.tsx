import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Lock, Clock, AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { fetchHospitalizationDetail, fetchOrders, fetchNursingRecords, createNursingRecord, fetchStaff } from '@/lib/api'
import type { HospitalizationDetail, Order, NursingRecord } from 'shared/types'

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

export default function Nursing() {
  const { id } = useParams<{ id: string }>()
  const { currentRole, currentStaff, staffList, setStaffList } = useAppStore()
  const [detail, setDetail] = useState<HospitalizationDetail | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [records, setRecords] = useState<NursingRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<ExecForm | null>(null)
  const [toast, setToast] = useState('')

  const loadData = useCallback(async () => {
    if (!id) return
    const [d, o, r, s] = await Promise.all([
      fetchHospitalizationDetail(id), fetchOrders(id), fetchNursingRecords(id),
      staffList.length === 0 ? fetchStaff() : Promise.resolve(staffList),
    ])
    setDetail(d); setOrders(o); setRecords(r)
    if (Array.isArray(s) && s.length > 0) setStaffList(s)
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
                    </div>
                    {r.observation && (
                      <p className="mt-1.5 text-xs text-slate-500">{r.observation}</p>
                    )}
                    {isAbnormal && r.abnormalNote && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                        <AlertTriangle size={12} />{r.abnormalNote}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
