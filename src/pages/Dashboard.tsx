import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BedDouble,
  ClipboardList,
  Syringe,
  AlertTriangle,
  Plus,
  X,
  Eye,
  Pencil,
  LogOut,
} from 'lucide-react'
import { fetchHospitalizations, dischargeHospitalization, fetchStatistics, type Statistics } from '@/lib/api'
import { useAppStore } from '@/store/appStore'
import type { Hospitalization } from 'shared/types'

type FilterTab = 'all' | 'admitted' | 'discharged'

const vaccineLabel: Record<string, { text: string; cls: string }> = {
  complete: { text: '完整', cls: 'bg-green-100 text-green-700' },
  incomplete: { text: '缺失', cls: 'bg-orange-100 text-orange-700' },
  unknown: { text: '未知', cls: 'bg-slate-100 text-slate-500' },
}

const statusLabel: Record<string, { text: string; cls: string }> = {
  admitted: { text: '住院中', cls: 'bg-green-100 text-green-700' },
  discharged: { text: '已出院', cls: 'bg-slate-100 text-slate-500' },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { currentRole, hospitalizations, setHospitalizations, setIsLoading } =
    useAppStore()

  const [filter, setFilter] = useState<FilterTab>('all')
  const [showVaccineBanner, setShowVaccineBanner] = useState(true)
  const [showDepositBanner, setShowDepositBanner] = useState(true)
  const [statistics, setStatistics] = useState<Statistics>({
    admittedCount: 0,
    pendingOrdersCount: 0,
    pendingNursingCount: 0,
    alertCount: 0,
  })

  useEffect(() => {
    loadData()
  }, [filter])

  async function loadData() {
    setIsLoading(true)
    try {
      const status = filter === 'all' ? undefined : filter
      const [list, stats] = await Promise.all([
        fetchHospitalizations(status),
        fetchStatistics(),
      ])
      setHospitalizations(list)
      setStatistics(stats)
    } finally {
      setIsLoading(false)
    }
  }

  const hasVaccineIncomplete = hospitalizations.some(
    (h) => h.vaccineStatus === 'incomplete' && h.status === 'admitted',
  )
  const hasLowDeposit = hospitalizations.some(
    (h) => h.depositAmount - h.depositUsed <= 0 && h.status === 'admitted',
  )

  const admittedCount = statistics.admittedCount
  const pendingOrders = statistics.pendingOrdersCount
  const pendingNursing = statistics.pendingNursingCount
  const alertCount = statistics.alertCount

  function handleViewDetail(h: Hospitalization) {
    const roleRoutes: Record<string, string> = {
      vet: `/orders/${h.id}`,
      nurse: `/nursing/${h.id}`,
      billing: `/billing/${h.id}`,
    }
    navigate(roleRoutes[currentRole] || `/admission/${h.id}`)
  }

  async function handleDischarge(h: Hospitalization) {
    if (!confirm(`确认对 ${h.petName} 办理出院？`)) return
    await dischargeHospitalization(h.id)
    loadData()
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'admitted', label: '住院中' },
    { key: 'discharged', label: '已出院' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<BedDouble size={24} className="text-blue-500" />}
          value={admittedCount}
          label="住院中"
        />
        <StatCard
          icon={<ClipboardList size={24} className="text-amber-500" />}
          value={pendingOrders}
          label="待开医嘱"
        />
        <StatCard
          icon={<Syringe size={24} className="text-purple-500" />}
          value={pendingNursing}
          label="待执行护理"
        />
        <StatCard
          icon={<AlertTriangle size={24} className="text-red-500" />}
          value={alertCount}
          label="预警"
        />
      </div>

      {hasVaccineIncomplete && showVaccineBanner && (
        <div className="flex items-center justify-between rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-700">
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} />
            疫苗状态缺失，需隔离护理
          </span>
          <button onClick={() => setShowVaccineBanner(false)}>
            <X size={16} />
          </button>
        </div>
      )}

      {hasLowDeposit && showDepositBanner && (
        <div className="flex items-center justify-between rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} />
            押金余额不足
          </span>
          <button onClick={() => setShowDepositBanner(false)}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === t.key
                ? 'bg-blue-500 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-slate-500">
              <th className="px-4 py-3 font-medium">宠物名</th>
              <th className="px-4 py-3 font-medium">种类</th>
              <th className="px-4 py-3 font-medium">主人</th>
              <th className="px-4 py-3 font-medium">笼号</th>
              <th className="px-4 py-3 font-medium">入院日期</th>
              <th className="px-4 py-3 font-medium">疫苗状态</th>
              <th className="px-4 py-3 font-medium">隔离</th>
              <th className="px-4 py-3 font-medium">押金余额</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {hospitalizations.map((h) => (
              <tr
                key={h.id}
                className="border-b border-slate-50 transition-colors hover:bg-blue-50/50"
              >
                <td className="px-4 py-3 font-medium text-slate-800">
                  {h.petName}
                </td>
                <td className="px-4 py-3 text-slate-600">{h.petType}</td>
                <td className="px-4 py-3 text-slate-600">{h.ownerName}</td>
                <td className="px-4 py-3 text-slate-600">{h.cageNumber}</td>
                <td className="px-4 py-3 text-slate-600">{h.admissionDate}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${vaccineLabel[h.vaccineStatus].cls}`}
                  >
                    {vaccineLabel[h.vaccineStatus].text}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {h.isolationRequired ? '是' : '否'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  ¥{(h.depositAmount - h.depositUsed).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusLabel[h.status].cls}`}
                  >
                    {statusLabel[h.status].text}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleViewDetail(h)}
                      className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-500"
                      title="查看详情"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => navigate(`/admission/${h.id}`)}
                      className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-500"
                      title="编辑"
                    >
                      <Pencil size={16} />
                    </button>
                    {currentRole === 'receptionist' &&
                      h.status === 'admitted' && (
                        <button
                          onClick={() => handleDischarge(h)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          title="出院"
                        >
                          <LogOut size={16} />
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
            {hospitalizations.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-12 text-center text-slate-400"
                >
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => navigate('/admission/new')}
        className="fixed bottom-8 right-8 flex items-center gap-2 rounded-full bg-blue-500 px-5 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-blue-600"
      >
        <Plus size={18} />
        新增住院
      </button>
    </div>
  )
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: number
  label: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  )
}
