import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Clock, AlertTriangle, ClipboardList, UserCheck, HeartPulse, Pill, AlertCircle } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import {
  fetchCurrentShift, fetchHospitalizations, fetchOrders, handoverShift, fetchStaff,
  fetchHandoverChecklist, fetchMedicationTasks,
} from '@/lib/api'
import type { NursingRecord, Order, Hospitalization, HandoverChecklist, MedicationTask } from 'shared/types'

interface ShiftData {
  id: string
  nurseOnDuty: string
  startTime: string
  endTime: string | null
  handoverNotes: string
  status: string
  nursingRecords: NursingRecord[]
}

export default function Handover() {
  const { staffList, currentStaff, setStaffList } = useAppStore()
  const [shift, setShift] = useState<ShiftData | null>(null)
  const [hospitalizations, setHospitalizations] = useState<Hospitalization[]>([])
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [checklist, setChecklist] = useState<HandoverChecklist | null>(null)
  const [pendingMedTasks, setPendingMedTasks] = useState<MedicationTask[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [nextNurseId, setNextNurseId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [showForceConfirm, setShowForceConfirm] = useState(false)

  const nurses = staffList.filter((s) => s.role === 'nurse')

  const loadOrders = useCallback(async (hosps: Hospitalization[]) => {
    const results = await Promise.all(
      hosps.filter((h) => h.status === 'admitted').map((h) => fetchOrders(h.id))
    )
    const orders = results.flat().filter((o) => o.status === 'active')
    setAllOrders(orders)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const [shiftData, hosps, s] = await Promise.all([
          fetchCurrentShift(),
          fetchHospitalizations('admitted'),
          staffList.length === 0 ? fetchStaff() : Promise.resolve(staffList),
        ])
        setShift(shiftData as unknown as ShiftData)
        setHospitalizations(hosps)
        if (Array.isArray(s) && s.length > 0) setStaffList(s)
        await loadOrders(hosps)
        if (shiftData?.id) {
          const [cl, tasks] = await Promise.all([
            fetchHandoverChecklist(shiftData.id),
            fetchMedicationTasks('pending'),
          ])
          setChecklist(cl)
          setPendingMedTasks(tasks)
        }
      } catch {
        setError('获取班次信息失败')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [loadOrders, staffList, setStaffList])

  const abnormalRecords: NursingRecord[] = shift?.nursingRecords?.filter((r) => r.result === 'abnormal') ?? []
  const activeOrders = allOrders

  const petNameMap = new Map(hospitalizations.map((h) => [h.id, h.petName]))

  const handleHandover = async (force = false) => {
    if (!shift || !nextNurseId) return
    const nurseOffDutyId = currentStaff?.id || staffList.find(s => s.role === 'nurse')?.id
    if (!nurseOffDutyId) return
    setSubmitting(true)
    setError('')
    try {
      await handoverShift({
        nurseOffDuty: nurseOffDutyId,
        nurseOnDuty: nextNurseId,
        handoverNotes: notes,
        forceHandover: force,
      })
      setDone(true)
    } catch (e: unknown) {
      const err = e as any
      if (err?.extra?.checklist) {
        setChecklist(err.extra.checklist)
        setShowForceConfirm(true)
      }
      setError(e instanceof Error ? e.message : '交接失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-slate-400">加载中...</div>
  }

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <UserCheck size={40} className="text-green-600" />
        </div>
        <p className="text-xl font-semibold text-slate-700">交接完成</p>
        <p className="text-sm text-slate-400">接班护士已确认接手</p>
      </div>
    )
  }

  if (!shift) {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        当前无活跃班次
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <nav className="flex items-center gap-1 text-sm text-slate-500">
        <span>工作台</span>
        <ChevronRight size={14} />
        <span className="text-slate-800">交接班</span>
      </nav>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex w-1/2 flex-col">
          <div className="bg-slate-800 px-5 py-3">
            <h2 className="text-base font-semibold text-white">当班总结</h2>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">当班护士：</span>
                <span className="font-medium text-slate-800">
                  {staffList.find((s) => s.id === shift.nurseOnDuty)?.name ?? shift.nurseOnDuty}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock size={14} className="text-slate-400" />
                <span className="text-slate-500">开始时间：</span>
                <span className="text-slate-700">{new Date(shift.startTime).toLocaleString('zh-CN')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <ClipboardList size={14} className="text-slate-400" />
                <span className="text-slate-500">护理记录数：</span>
                <span className="font-medium text-slate-800">{shift.nursingRecords?.length ?? 0}</span>
              </div>
            </div>

            <div>
              <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold text-red-600">
                <AlertTriangle size={14} />
                异常记录
              </h3>
              {abnormalRecords.length === 0 ? (
                <p className="text-sm text-slate-400">暂无异常记录</p>
              ) : (
                <div className="space-y-2">
                  {abnormalRecords.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-md border-l-4 border-l-red-500 bg-red-50 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-slate-800">
                        {petNameMap.get(r.hospitalizationId) ?? '未知宠物'}
                      </p>
                      <p className="text-xs text-slate-600">{r.abnormalNote ?? '异常'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {checklist && checklist.criticalObservations.missingCount > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold text-red-700">
                  <HeartPulse size={14} fill="currentColor" />
                  本班重症观察漏记（{checklist.criticalObservations.missingCount}只）
                </h3>
                <div className="space-y-2">
                  {checklist.criticalObservations.missingPets.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-md border-l-4 border-l-red-600 bg-red-50 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-red-800 flex items-center gap-1">
                        <AlertCircle size={12} />{p.petName}
                      </p>
                      <p className="text-xs text-red-600">本班次未填写重症观察记录</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {checklist && checklist.previousShiftMissing && checklist.previousShiftMissing.missingCount > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold text-amber-700">
                  <HeartPulse size={14} fill="currentColor" />
                  上班次重症观察未补录（{checklist.previousShiftMissing.missingCount}只）
                </h3>
                <div className="space-y-2">
                  {checklist.previousShiftMissing.missingPets.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-md border-l-4 border-l-amber-500 bg-amber-50 px-3 py-2 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-amber-800 flex items-center gap-1">
                          <AlertCircle size={12} />{p.petName}
                        </p>
                        <p className="text-xs text-amber-600">上班次重症观察未补录，须先补录再交接</p>
                      </div>
                      <Link
                        to={`/nursing/${p.id}`}
                        className="rounded-md bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700 whitespace-nowrap"
                      >
                        去补录
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingMedTasks.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold text-amber-700">
                  <Pill size={14} />
                  待补药任务（{pendingMedTasks.length}项）
                </h3>
                <div className="space-y-2">
                  {pendingMedTasks.map((t) => (
                    <div
                      key={t.id}
                      className={`rounded-md border-l-4 px-3 py-2 ${
                        t.priority === 'urgent'
                          ? 'border-l-red-500 bg-red-50'
                          : 'border-l-amber-500 bg-amber-50'
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-800">
                        {petNameMap.get(t.hospitalizationId) ?? '未知宠物'}
                        {t.priority === 'urgent' && (
                          <span className="ml-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white">紧急</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-600">
                        {t.medicationName}：需补 {t.pendingQuantity}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold text-orange-600">
                <ClipboardList size={14} />
                未完成医嘱
              </h3>
              {activeOrders.length === 0 ? (
                <p className="text-sm text-slate-400">暂无未完成医嘱</p>
              ) : (
                <div className="space-y-2">
                  {activeOrders.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-md border-l-4 border-l-orange-500 bg-orange-50 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-slate-800">
                        {petNameMap.get(o.hospitalizationId) ?? '未知宠物'}
                      </p>
                      <p className="text-xs text-slate-600">{o.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">交接班备注</label>
              <textarea
                rows={4}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="请输入交接班备注..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="w-px bg-slate-200" />

        <div className="flex w-1/2 flex-col">
          <div className="bg-blue-600 px-5 py-3">
            <h2 className="text-base font-semibold text-white">接班确认</h2>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">接班护士</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={nextNurseId}
                onChange={(e) => setNextNurseId(e.target.value)}
              >
                <option value="">请选择接班护士</option>
                {nurses
                  .filter((n) => n.id !== currentStaff?.id)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
              </select>
            </div>

            <p className="text-sm text-slate-600">
              确认接收以下事项，并承担后续护理责任：
            </p>

            {checklist && checklist.criticalObservations.missingCount > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-red-700">
                  <AlertCircle size={14} />
                  本班重症观察漏记（{checklist.criticalObservations.missingCount}只）
                </h4>
                <div className="space-y-2">
                  {checklist.criticalObservations.missingPets.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-md border-l-4 border-l-red-600 bg-red-50 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-red-800">{p.petName}</p>
                      <p className="text-xs text-red-600">本班次未填写重症观察记录</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {checklist && checklist.previousShiftMissing && checklist.previousShiftMissing.missingCount > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-amber-700">
                  <AlertCircle size={14} />
                  上班次重症观察未补录（{checklist.previousShiftMissing.missingCount}只）
                </h4>
                <div className="space-y-2">
                  {checklist.previousShiftMissing.missingPets.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-md border-l-4 border-l-amber-500 bg-amber-50 px-3 py-2 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-amber-800">{p.petName}</p>
                        <p className="text-xs text-amber-600">须先补录上班次观察再交接</p>
                      </div>
                      <Link
                        to={`/nursing/${p.id}`}
                        className="rounded-md bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700 whitespace-nowrap"
                      >
                        去补录
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingMedTasks.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-amber-700">
                  <Pill size={14} />
                  待补药任务（{pendingMedTasks.length}项）
                </h4>
                <div className="space-y-2">
                  {pendingMedTasks.map((t) => (
                    <div
                      key={t.id}
                      className={`rounded-md border-l-4 px-3 py-2 ${
                        t.priority === 'urgent'
                          ? 'border-l-red-500 bg-red-50'
                          : 'border-l-amber-500 bg-amber-50'
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-800">
                        {petNameMap.get(t.hospitalizationId) ?? '未知宠物'}
                        {t.priority === 'urgent' && (
                          <span className="ml-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white">紧急</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-600">
                        {t.medicationName}：需补 {t.pendingQuantity}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="mb-2 text-sm font-semibold text-red-600">异常事项</h4>
              {abnormalRecords.length === 0 ? (
                <p className="text-sm text-slate-400">无</p>
              ) : (
                <div className="space-y-2">
                  {abnormalRecords.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-md border-l-4 border-l-red-500 bg-red-50 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-slate-800">
                        {petNameMap.get(r.hospitalizationId) ?? '未知宠物'}
                      </p>
                      <p className="text-xs text-slate-600">{r.abnormalNote ?? '异常'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-orange-600">未完成医嘱</h4>
              {activeOrders.length === 0 ? (
                <p className="text-sm text-slate-400">无</p>
              ) : (
                <div className="space-y-2">
                  {activeOrders.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-md border-l-4 border-l-orange-500 bg-orange-50 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-slate-800">
                        {petNameMap.get(o.hospitalizationId) ?? '未知宠物'}
                      </p>
                      <p className="text-xs text-slate-600">{o.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showForceConfirm && (
              <div className="rounded-md border-2 border-red-300 bg-red-50 p-3">
                <p className="mb-2 text-sm font-medium text-red-700">
                  存在未完成事项，确定强制交接吗？
                </p>
                <p className="mb-3 text-xs text-red-600">
                  强制交接将跳过所有校验，由接班护士承担后续处理责任。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowForceConfirm(false)}
                    className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleHandover(true)}
                    className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    确认强制交接
                  </button>
                </div>
              </div>
            )}

            {!showForceConfirm && (
              <button
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                disabled={!nextNurseId || submitting}
                onClick={() => handleHandover(false)}
              >
                {submitting ? '交接中...' : '确认交接'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
