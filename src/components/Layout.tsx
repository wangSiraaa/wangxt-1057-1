import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ClipboardPlus,
  FileText,
  Syringe,
  ArrowLeftRight,
  Receipt,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { fetchStaff } from '@/lib/api'

const navItems = [
  { to: '/', label: '工作台', icon: LayoutDashboard },
  { to: '/admission', label: '住院登记', icon: ClipboardPlus },
  { to: '/orders', label: '护理医嘱', icon: FileText },
  { to: '/nursing', label: '护理执行', icon: Syringe },
  { to: '/handover', label: '交接班', icon: ArrowLeftRight },
  { to: '/billing', label: '费用结算', icon: Receipt },
]

const roleOptions = [
  { value: 'receptionist', label: '前台' },
  { value: 'vet', label: '兽医' },
  { value: 'nurse', label: '护士' },
  { value: 'pharmacist', label: '药房' },
  { value: 'billing', label: '结算' },
]

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const { currentRole, setCurrentRole, currentStaff, setCurrentStaff, staffList, setStaffList } = useAppStore()
  const location = useLocation()

  useEffect(() => {
    async function loadStaff() {
      if (staffList.length === 0) {
        const list = await fetchStaff()
        setStaffList(list)
      }
    }
    loadStaff()
  }, [staffList.length, setStaffList])

  useEffect(() => {
    if (!currentStaff && staffList.length > 0) {
      const staff = staffList.find((s) => s.role === currentRole) || staffList[0]
      setCurrentStaff(staff)
    }
  }, [currentRole, currentStaff, staffList, setCurrentStaff])

  useEffect(() => {
    if (currentStaff && currentStaff.role !== currentRole) {
      const matching = staffList.find((s) => s.role === currentRole)
      if (matching) setCurrentStaff(matching)
    }
  }, [currentRole, currentStaff, staffList, setCurrentStaff])

  const sidebarWidth = collapsed ? 'w-16' : 'w-[200px]'

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={`${sidebarWidth} flex flex-col bg-[#1e293b] text-white transition-all duration-300 shrink-0`}
      >
        <div className="flex h-14 items-center justify-between px-4">
          {!collapsed && (
            <span className="text-base font-semibold whitespace-nowrap">住院护理系统</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded p-1 hover:bg-white/10"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-2">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive =
              to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(to)
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
                title={collapsed ? label : undefined}
              >
                <Icon size={20} className="shrink-0" />
                {!collapsed && <span className="whitespace-nowrap">{label}</span>}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-500">当前角色</label>
            <select
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {currentStaff && (
            <div className="text-sm text-slate-600">
              {currentStaff.name} ({currentStaff.role})
            </div>
          )}
        </header>

        <main className="flex-1 overflow-auto bg-[#f8fafc] p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
