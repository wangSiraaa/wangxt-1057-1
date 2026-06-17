import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Plus, Check, Ban, Pencil, X, Pill, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import {
  fetchHospitalizationDetail, fetchOrders, createOrder, confirmOrder, stopOrder, updateOrder, fetchStaff,
  fetchHospitalMedicationTasks, completeMedicationTask, checkOrderStock,
} from '@/lib/api'
import type { HospitalizationDetail, Order, MedicationTask } from 'shared/types'

type TabKey = Order['type']

const TABS: { key: TabKey; label: string }[] = [
  { key: 'long_term', label: '长期医嘱' },
  { key: 'temporary', label: '临时医嘱' },
  { key: 'pending_confirm', label: '需确认医嘱' },
]

const CATEGORY_MAP: Record<Order['category'], string> = {
  medication: '药品', observation: '观察', care: '护理', examination: '检查',
}

const TYPE_MAP: Record<Order['type'], string> = {
  long_term: '长期', temporary: '临时', pending_confirm: '需确认',
}

const VACCINE_MAP: Record<string, { label: string; cls: string }> = {
  complete: { label: '疫苗完整', cls: 'bg-green-100 text-green-700' },
  incomplete: { label: '疫苗不全', cls: 'bg-yellow-100 text-yellow-700' },
  unknown: { label: '疫苗未知', cls: 'bg-gray-100 text-gray-600' },
}

const TASK_STATUS_MAP: Record<MedicationTask['status'], { label: string; cls: string }> = {
  pending: { label: '待补药', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: '已完成', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', cls: 'bg-gray-100 text-gray-600' },
}

interface FormData {
  type: Order['type']; category: Order['category']; content: string
  dosage: string; frequency: string; startDate: string
  medicationName: string; medicationQuantity: string; medicationStockAvailable: string
}

const emptyForm = (): FormData => ({
  type: 'long_term', category: 'medication', content: '',
  dosage: '', frequency: '', startDate: new Date().toISOString().slice(0, 10),
  medicationName: '', medicationQuantity: '', medicationStockAvailable: '',
})

export default function Orders() {
  const { id } = useParams<{ id: string }>()
  const { currentRole, currentStaff, staffList, setStaffList } = useAppStore()
  const [detail, setDetail] = useState<HospitalizationDetail | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [medTasks, setMedTasks] = useState<MedicationTask[]>([])
  const [tab, setTab] = useState<TabKey>('long_term')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm())
  const [stopTarget, setStopTarget] = useState<Order | null>(null)
  const [editTarget, setEditTarget] = useState<Order | null>(null)
  const [editContent, setEditContent] = useState('')
  const [toast, setToast] = useState('')

  const loadData = useCallback(async () => {
    if (!id) return
    const [d, o, s, mt] = await Promise.all([
      fetchHospitalizationDetail(id), fetchOrders(id),
      staffList.length === 0 ? fetchStaff() : Promise.resolve(staffList),
      fetchHospitalMedicationTasks(id),
    ])
    setDetail(d); setOrders(o); setMedTasks(mt)
    if (Array.isArray(s) && s.length > 0) setStaffList(s)
  }, [id, staffList, setStaffList])

  useEffect(() => { loadData() }, [loadData])

  const h = detail
  const filtered = orders.filter((o) => o.type === tab)
  const isVet = currentRole === 'vet'
  const pendingTasks = medTasks.filter((t) => t.status === 'pending')

  const handleAdd = async () => {
    if (!id) return
    const vetId = currentStaff?.id || staffList.find(s => s.role === 'vet')?.id || ''
    const order = await createOrder(id, {
      vetId,
      type: form.type, category: form.category, content: form.content,
      dosage: form.category === 'medication' ? form.dosage : '',
      frequency: form.type === 'long_term' ? form.frequency : '',
      startDate: form.startDate, status: 'active', confirmed: form.type !== 'pending_confirm',
      medicationName: form.category === 'medication' ? form.medicationName || null : null,
      medicationQuantity: form.category === 'medication' && form.medicationQuantity ? parseFloat(form.medicationQuantity) : 0,
      medicationStockAvailable: form.category === 'medication' && form.medicationStockAvailable ? parseFloat(form.medicationStockAvailable) : 0,
      stockChecked: form.category === 'medication' && form.medicationStockAvailable !== '',
    })
    if (form.category === 'medication' && order && form.medicationName && form.medicationQuantity && form.medicationStockAvailable !== '') {
      try {
        const result = await checkOrderStock(order.id, form.medicationName, parseFloat(form.medicationQuantity), parseFloat(form.medicationStockAvailable)) as any
        if (!result?.sufficient && result?.task) {
          setToast(`已创建补药任务：${form.medicationName} 需补 ${result.task.pendingQuantity}`)
          setTimeout(() => setToast(''), 4000)
        }
      } catch {}
    }
    setShowAdd(false); setForm(emptyForm()); loadData()
  }

  const handleConfirm = async (orderId: string) => {
    const vetId = currentStaff?.id || staffList.find(s => s.role === 'vet')?.id || ''
    try {
      const result = await confirmOrder(orderId, vetId) as any
      if (result?.medicationTask) {
        const task = result.medicationTask
        setToast(`库存不足，已自动创建补药任务：${task.medicationName || '药品'} 需补 ${task.pendingQuantity}`)
        setTimeout(() => setToast(''), 5000)
      }
    } catch (e: any) {
      setToast(e?.message || '确认失败')
      setTimeout(() => setToast(''), 3000)
    }
    loadData()
  }

  const handleStop = async () => {
    if (!stopTarget) return
    const reason = prompt('请输入停用原因（可选）：') || undefined
    await stopOrder(stopTarget.id, reason); setStopTarget(null); loadData()
  }

  const handleEdit = async () => {
    if (!editTarget) return
    await updateOrder(editTarget.id, { content: editContent })
    setEditTarget(null); setEditContent(''); loadData()
  }

  const handleCompleteTask = async (taskId: string) => {
    const notes = prompt('补药完成备注（可选）：') || undefined
    await completeMedicationTask(taskId, notes)
    loadData()
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

  const rowCls = (o: Order) => {
    if (o.status === 'stopped') return 'text-slate-400 line-through'
    if (o.type === 'pending_confirm' && !o.confirmed) return 'bg-orange-50'
    return ''
  }

  const statusBadge = (o: Order) => {
    if (o.status === 'stopped') return <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-500">已停用</span>
    if (o.status === 'completed') return <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">已完成</span>
    if (o.type === 'pending_confirm' && !o.confirmed) return <span className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700">待确认</span>
    return <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">执行中</span>
  }

  return (
    <div className="space-y-4">
      <nav className="text-sm text-slate-500">
        <Link to="/" className="hover:text-blue-600">工作台</Link>
        <span className="mx-1.5">&gt;</span>
        <span>护理医嘱</span>
        {h && <><span className="mx-1.5">&gt;</span><span className="text-slate-800">{h.petName}</span></>}
      </nav>

      {petBar}

      {toast && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700 border border-amber-200">
          <AlertTriangle size={16} />{toast}
        </div>
      )}

      {pendingTasks.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <Pill size={16} />待补药任务（{pendingTasks.length}）
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pendingTasks.map((t) => (
              <div key={t.id} className="rounded-md border border-amber-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-sm font-medium text-slate-800">
                      {t.medicationName}
                      {t.priority === 'urgent' && (
                        <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white">紧急</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      需补 {t.pendingQuantity}（可用 {t.availableQuantity}/{t.requiredQuantity}）
                    </p>
                  </div>
                  <button onClick={() => handleCompleteTask(t.id)}
                    className="shrink-0 flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
                    <CheckCircle size={12} />完成
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex rounded-lg bg-white shadow-sm overflow-hidden">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-2 text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        {isVet && (
          <button onClick={() => setShowAdd(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={16} />新增医嘱
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-3 font-medium">医嘱内容</th>
              <th className="px-4 py-3 font-medium">类别</th>
              <th className="px-4 py-3 font-medium">剂量</th>
              <th className="px-4 py-3 font-medium">频率</th>
              <th className="px-4 py-3 font-medium">开始日期</th>
              <th className="px-4 py-3 font-medium">状态</th>
              {isVet && <th className="px-4 py-3 font-medium">操作</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={isVet ? 7 : 6} className="px-4 py-8 text-center text-slate-400">暂无医嘱</td></tr>
            )}
            {filtered.map((o) => (
              <tr key={o.id} className={`border-b last:border-0 ${rowCls(o)}`}>
                <td className="px-4 py-3 max-w-[240px] truncate">{o.content}</td>
                <td className="px-4 py-3">{CATEGORY_MAP[o.category]}</td>
                <td className="px-4 py-3">{o.dosage || '-'}</td>
                <td className="px-4 py-3">{o.frequency || '-'}</td>
                <td className="px-4 py-3">{o.startDate?.slice(0, 10)}</td>
                <td className="px-4 py-3">{statusBadge(o)}</td>
                {isVet && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {o.type === 'pending_confirm' && !o.confirmed && o.status === 'active' && (
                        <button onClick={() => handleConfirm(o.id)}
                          className="flex items-center gap-1 rounded bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
                          <Check size={14} />确认
                        </button>
                      )}
                      {o.status === 'active' && (
                        <button onClick={() => setStopTarget(o)}
                          className="flex items-center gap-1 rounded bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100">
                          <Ban size={14} />停用
                        </button>
                      )}
                      {o.status === 'active' && (
                        <button onClick={() => { setEditTarget(o); setEditContent(o.content) }}
                          className="flex items-center gap-1 rounded bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                          <Pencil size={14} />编辑
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">新增医嘱</h3>
              <button onClick={() => setShowAdd(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-4">
                <label className="flex-1">
                  <span className="mb-1 block text-xs text-slate-500">医嘱类型</span>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Order['type'] })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="flex-1">
                  <span className="mb-1 block text-xs text-slate-500">类别</span>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Order['category'] })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    {Object.entries(CATEGORY_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
              </div>
              <label>
                <span className="mb-1 block text-xs text-slate-500">医嘱内容</span>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </label>
              {form.category === 'medication' && (
                <>
                  <label>
                    <span className="mb-1 block text-xs text-slate-500">剂量</span>
                    <input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label>
                      <span className="mb-1 block text-xs text-slate-500">药品名称</span>
                      <input value={form.medicationName} onChange={(e) => setForm({ ...form, medicationName: e.target.value })} placeholder="如：阿莫西林"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </label>
                    <div />
                    <label>
                      <span className="mb-1 block text-xs text-slate-500">医嘱用量</span>
                      <input type="number" step="0.1" value={form.medicationQuantity} onChange={(e) => setForm({ ...form, medicationQuantity: e.target.value })} placeholder="总用量"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-slate-500">当前库存</span>
                      <input type="number" step="0.1" value={form.medicationStockAvailable} onChange={(e) => setForm({ ...form, medicationStockAvailable: e.target.value })} placeholder="药房当前库存"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </label>
                  </div>
                  {form.medicationQuantity && form.medicationStockAvailable && parseFloat(form.medicationStockAvailable) < parseFloat(form.medicationQuantity) && (
                    <div className="flex items-center gap-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      <AlertTriangle size={12} />
                      库存不足（库存 {form.medicationStockAvailable} < 用量 {form.medicationQuantity}），系统将自动创建补药任务
                    </div>
                  )}
                </>
              )}
              {form.type === 'long_term' && (
                <label>
                  <span className="mb-1 block text-xs text-slate-500">频率</span>
                  <input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="如：每日2次"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </label>
              )}
              <label>
                <span className="mb-1 block text-xs text-slate-500">开始日期</span>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">取消</button>
              <button onClick={handleAdd} disabled={!form.content}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">保存</button>
            </div>
          </div>
        </div>
      )}

      {stopTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold text-slate-800">停用医嘱</h3>
            <p className="mb-4 text-sm text-slate-600">确定停用医嘱「{stopTarget.content}」？</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setStopTarget(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">取消</button>
              <button onClick={handleStop} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">确定停用</button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold text-slate-800">编辑医嘱</h3>
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setEditTarget(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">取消</button>
              <button onClick={handleEdit} disabled={!editContent}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
