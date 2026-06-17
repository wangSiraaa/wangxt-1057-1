import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronDown, ChevronUp, Plus, AlertCircle, CheckCircle2, XCircle, Info } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import {
  fetchHospitalizationDetail,
  fetchBilling,
  createBillingItem,
  settleBilling,
  fetchDischargeClosureSummary,
  terminateNursingRecord,
  terminateBillingItem,
  fetchNursingRecords,
} from '@/lib/api'
import type { HospitalizationDetail, BillingItem, DischargeClosureSummary, NursingRecord } from 'shared/types'

type Category = BillingItem['category']
const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'hospitalization', label: '住院费' },
  { key: 'medication', label: '药品费' },
  { key: 'nursing', label: '护理费' },
  { key: 'examination', label: '检查费' },
  { key: 'other', label: '其他' },
]

const STATUS_MAP: Record<string, { label: string; className: string; icon: any }> = {
  completed: { label: '已完成', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  terminated: { label: '已终止', className: 'bg-slate-200 text-slate-600', icon: XCircle },
  pending: { label: '进行中', className: 'bg-amber-100 text-amber-700', icon: Info },
}

interface AddForm {
  category: Category
  name: string
  amount: number
  quantity: number
}

export default function Billing() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentRole } = useAppStore()

  const [detail, setDetail] = useState<HospitalizationDetail | null>(null)
  const [items, setItems] = useState<BillingItem[]>([])
  const [nursingRecords, setNursingRecords] = useState<NursingRecord[]>([])
  const [closureSummary, setClosureSummary] = useState<DischargeClosureSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<Category>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<AddForm>({
    category: 'hospitalization',
    name: '',
    amount: 0,
    quantity: 1,
  })
  const [adding, setAdding] = useState(false)
  const [showSettle, setShowSettle] = useState(false)
  const [settling, setSettling] = useState(false)
  const [settleError, setSettleError] = useState('')
  const [earlyDischarge, setEarlyDischarge] = useState(false)
  const [earlyDischargeReason, setEarlyDischargeReason] = useState('')

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [d, b, n, c] = await Promise.all([
        fetchHospitalizationDetail(id),
        fetchBilling(id),
        fetchNursingRecords(id),
        fetchDischargeClosureSummary(id),
      ])
      setDetail(d)
      setItems(b)
      setNursingRecords(n)
      setClosureSummary(c)
      setExpanded(new Set(CATEGORIES.filter((cat) => b.some((i) => i.category === cat.key)).map((cat) => cat.key)))
    } catch {
      setError('获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const totalAmount = items.reduce((s, i) => s + i.totalAmount, 0)
  const depositAmount = detail?.depositAmount ?? 0
  const depositUsed = detail?.depositUsed ?? 0
  const depositRemaining = depositAmount - totalAmount
  const actualPay = Math.max(0, totalAmount - depositAmount)

  const depositPercent = depositAmount > 0 ? Math.min(100, (totalAmount / depositAmount) * 100) : 100
  const depositWarning: 'none' | 'low' | 'critical' =
    depositPercent < 50 ? 'none' : depositPercent < 80 ? 'low' : 'critical'

  const barColor =
    depositWarning === 'critical'
      ? 'bg-red-500'
      : depositWarning === 'low'
        ? 'bg-yellow-500'
        : 'bg-green-500'

  const pendingNursing = nursingRecords.filter((r) => r.status !== 'completed')
  const pendingBilling = items.filter((i) => i.status === 'pending')

  const toggleCategory = (key: Category) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleAdd = async () => {
    if (!id || !addForm.name || addForm.amount <= 0) return
    setAdding(true)
    try {
      const newItem = await createBillingItem(id, {
        category: addForm.category,
        name: addForm.name,
        amount: addForm.amount,
        quantity: addForm.quantity,
      })
      setItems((prev) => [...prev, newItem])
      setShowAdd(false)
      setAddForm({ category: 'hospitalization', name: '', amount: 0, quantity: 1 })
    } catch {
      setError('新增费用失败')
    } finally {
      setAdding(false)
    }
  }

  const handleTerminateNursing = async (recordId: string, category?: string) => {
    const reason = prompt('请输入终止原因：')
    if (!reason) return
    await terminateNursingRecord(recordId, reason, category)
    load()
  }

  const handleTerminateBilling = async (itemId: string, category?: string) => {
    const reason = prompt('请输入终止原因：')
    if (!reason) return
    await terminateBillingItem(itemId, reason, category)
    load()
  }

  const handleSettle = async () => {
    if (!id) return
    setSettling(true)
    setSettleError('')
    try {
      await settleBilling(id, earlyDischarge && earlyDischargeReason ? earlyDischargeReason : undefined)
      navigate('/')
    } catch (e: unknown) {
      setSettleError(e instanceof Error ? e.message : '结算失败')
      setShowSettle(false)
    } finally {
      setSettling(false)
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-slate-400">加载中...</div>
  }

  if (!detail) {
    return <div className="flex h-full items-center justify-center text-red-500">住院记录不存在</div>
  }

  const isBillingRole = currentRole === 'billing'

  const categoryItems = (key: Category) => items.filter((i) => i.category === key)

  return (
    <div className="flex h-full flex-col pb-20">
      <nav className="flex items-center gap-1 text-sm text-slate-500">
        <span>工作台</span>
        <ChevronRight size={14} />
        <span>费用结算</span>
        <ChevronRight size={14} />
        <span className="text-slate-800">{detail.petName}</span>
      </nav>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {settleError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{settleError}</span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white px-5 py-3">
        <div className="text-sm">
          <span className="text-slate-500">宠物：</span>
          <span className="font-medium text-slate-800">{detail.petName}</span>
        </div>
        <div className="text-sm">
          <span className="text-slate-500">品种：</span>
          <span className="text-slate-700">{detail.breed || detail.petType}</span>
        </div>
        <div className="text-sm">
          <span className="text-slate-500">主人：</span>
          <span className="text-slate-700">{detail.ownerName}</span>
        </div>
        <div className="text-sm">
          <span className="text-slate-500">笼位：</span>
          <span className="text-slate-700">{detail.cageNumber}</span>
        </div>
      </div>

      {closureSummary && (closureSummary.summary.unclosedItemCount > 0 || closureSummary.summary.nursingTerminatedCount > 0 || closureSummary.summary.billingTerminatedCount > 0) && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertCircle size={16} />出院前未闭环事项
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-amber-200 bg-white p-3">
              <p className="text-xs text-slate-500">待补药任务</p>
              <p className={`mt-1 text-xl font-bold ${closureSummary.summary.pendingMedicationTaskCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {closureSummary.summary.pendingMedicationTaskCount} 项
              </p>
            </div>
            <div className="rounded-md border border-amber-200 bg-white p-3">
              <p className="text-xs text-slate-500">未完成护理</p>
              <p className={`mt-1 text-xl font-bold ${closureSummary.summary.nursingCompletedCount < (closureSummary.summary.orderCount) ? 'text-red-600' : 'text-green-600'}`}>
                {closureSummary.summary.nursingCompletedCount} / {closureSummary.summary.orderCount}
              </p>
            </div>
            <div className="rounded-md border border-amber-200 bg-white p-3">
              <p className="text-xs text-slate-500">提前接回终止</p>
              <p className={`mt-1 text-xl font-bold ${closureSummary.summary.nursingEarlyDischargeCount > 0 || closureSummary.summary.billingEarlyDischargeCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {closureSummary.summary.nursingEarlyDischargeCount + closureSummary.summary.billingEarlyDischargeCount} 项
              </p>
            </div>
            <div className="rounded-md border border-amber-200 bg-white p-3">
              <p className="text-xs text-slate-500">临床终止</p>
              <p className="mt-1 text-xl font-bold text-slate-600">
                {closureSummary.summary.nursingClinicalTerminatedCount + closureSummary.summary.billingClinicalTerminatedCount} 项
              </p>
            </div>
          </div>
          {closureSummary.unclosedItems && closureSummary.unclosedItems.length > 0 && (
            <div className="mt-3 space-y-1">
              {closureSummary.unclosedItems.slice(0, 8).map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded bg-white/60 px-3 py-1.5 text-xs">
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">{item.type}</span>
                  <span className="text-slate-700">{item.name}</span>
                </div>
              ))}
            </div>
          )}
          {closureSummary.earlyDischargeNursing && closureSummary.earlyDischargeNursing.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-orange-700">提前接回终止的护理：</p>
              <div className="space-y-1">
                {closureSummary.earlyDischargeNursing.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded bg-orange-50 px-3 py-1.5 text-xs">
                    <span className="rounded bg-orange-200 px-1.5 py-0.5 text-orange-800">提前接回</span>
                    <span className="text-slate-700">{r.terminatedReason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {closureSummary.clinicalTerminatedNursing && closureSummary.clinicalTerminatedNursing.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-slate-600">临床原因终止的护理：</p>
              <div className="space-y-1">
                {closureSummary.clinicalTerminatedNursing.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded bg-slate-50 px-3 py-1.5 text-xs">
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700">临床终止</span>
                    <span className="text-slate-700">{r.terminatedReason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {pendingNursing.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <Info size={16} />待处理护理记录（{pendingNursing.length}项）
          </h3>
          <div className="space-y-2">
            {pendingNursing.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm text-slate-800">
                    <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${STATUS_MAP[r.status || 'pending'].className}`}>
                      {(() => { const I = STATUS_MAP[r.status || 'pending'].icon; return <I size={12} /> })()}
                      {STATUS_MAP[r.status || 'pending'].label}
                    </span>
                    {r.typeName} - {r.content}
                  </p>
                  {r.terminatedReason && (
                    <p className="mt-0.5 text-xs text-slate-500">终止原因：{r.terminatedReason}</p>
                  )}
                </div>
                {r.status !== 'completed' && r.status !== 'terminated' && (
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => handleTerminateNursing(r.id, 'early_discharge')}
                      className="rounded border border-orange-300 px-2 py-1 text-xs text-orange-600 hover:bg-orange-50">
                      提前接回
                    </button>
                    <button onClick={() => handleTerminateNursing(r.id, 'clinical_decision')}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                      临床终止
                    </button>
                  </div>
                )}
                {r.status === 'terminated' && r.terminationCategory && (
                  <span className={`shrink-0 rounded px-2 py-1 text-xs ${
                    r.terminationCategory === 'early_discharge' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {r.terminationCategory === 'early_discharge' ? '提前接回' : r.terminationCategory === 'clinical_decision' ? '临床终止' : '其他'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-500">押金使用进度</span>
          <div className="flex gap-4">
            <span className="text-slate-600">押金：<b className="text-slate-800">¥{depositAmount.toFixed(2)}</b></span>
            <span className="text-slate-600">已用：<b className="text-orange-600">¥{totalAmount.toFixed(2)}</b></span>
            <span className="text-slate-600">剩余：<b className={depositRemaining >= 0 ? 'text-green-600' : 'text-red-600'}>¥{depositRemaining.toFixed(2)}</b></span>
          </div>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(100, depositPercent)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
        {CATEGORIES.map(({ key, label }) => {
          const list = categoryItems(key)
          const isOpen = expanded.has(key)
          const subtotal = list.reduce((s, i) => s + i.totalAmount, 0)
          return (
            <div key={key} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <button
                className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-slate-50"
                onClick={() => toggleCategory(key)}
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  <span className="text-sm font-medium text-slate-800">{label}</span>
                  <span className="text-xs text-slate-400">({list.length}项)</span>
                </div>
                <span className="text-sm font-semibold text-slate-700">¥{subtotal.toFixed(2)}</span>
              </button>
              {isOpen && list.length > 0 && (
                <div className="border-t border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500">
                        <th className="px-5 py-2 text-left font-medium">名称</th>
                        <th className="px-3 py-2 text-right font-medium">单价</th>
                        <th className="px-3 py-2 text-right font-medium">数量</th>
                        <th className="px-5 py-2 text-right font-medium">小计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((item, idx) => (
                        <tr key={item.id} className={idx % 2 === 1 ? 'bg-slate-50/50' : ''}>
                          <td className="px-5 py-2 text-slate-700">{item.name}</td>
                          <td className="px-3 py-2 text-right text-slate-600">¥{item.amount.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{item.quantity}</td>
                          <td className="px-5 py-2 text-right font-medium text-slate-800">¥{item.totalAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-8 text-sm">
            <div>
              <span className="text-slate-500">费用总计：</span>
              <span className="text-lg font-bold text-slate-800">¥{totalAmount.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500">押金抵扣：</span>
              <span className="font-semibold text-green-600">¥{Math.min(depositAmount, totalAmount).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500">实付金额：</span>
              <span className="text-lg font-bold text-blue-600">¥{actualPay.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex gap-3">
            {isBillingRole && (
              <>
                <button
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                  onClick={() => setShowAdd(true)}
                >
                  <span className="flex items-center gap-1"><Plus size={16} />新增费用</span>
                </button>
                <button
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                  onClick={() => { setSettleError(''); setShowSettle(true) }}
                >
                  结算出院
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold text-slate-800">新增费用</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-600">费用类别</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={addForm.category}
                  onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value as Category }))}
                >
                  {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">费用名称</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-sm text-slate-600">单价</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={addForm.amount || ''}
                    onChange={(e) => setAddForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-sm text-slate-600">数量</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={addForm.quantity}
                    onChange={(e) => setAddForm((f) => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50" onClick={() => setShowAdd(false)}>取消</button>
              <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300" disabled={adding || !addForm.name || addForm.amount <= 0} onClick={handleAdd}>
                {adding ? '添加中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSettle(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold text-slate-800">确认结算出院</h3>
            <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">费用总计</span>
                <span className="font-medium text-slate-800">¥{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">押金抵扣</span>
                <span className="font-medium text-green-600">¥{Math.min(depositAmount, totalAmount).toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-700">实付金额</span>
                  <span className="text-lg font-bold text-blue-600">¥{actualPay.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50" onClick={() => setShowSettle(false)}>取消</button>
              <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300" disabled={settling} onClick={handleSettle}>
                {settling ? '结算中...' : '确认结算'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
