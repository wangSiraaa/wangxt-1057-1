import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Admission from '@/pages/Admission'
import Orders from '@/pages/Orders'
import Nursing from '@/pages/Nursing'
import Handover from '@/pages/Handover'
import Billing from '@/pages/Billing'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/admission" element={<Admission />} />
          <Route path="/admission/:id" element={<Admission />} />
          <Route path="/orders/:id" element={<Orders />} />
          <Route path="/nursing/:id" element={<Nursing />} />
          <Route path="/handover" element={<Handover />} />
          <Route path="/billing/:id" element={<Billing />} />
        </Route>
      </Routes>
    </Router>
  )
}
