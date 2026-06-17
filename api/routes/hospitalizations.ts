import { Router, type Request, type Response } from 'express'
import * as svc from '../services/hospitalizationService.js'
import * as criticalSvc from '../services/criticalCareService.js'
import * as medTaskSvc from '../services/medicationTaskService.js'

const router = Router()

router.get('/statistics', (_req: Request, res: Response) => {
  const data = svc.getStatistics()
  res.json({ success: true, data })
})

router.get('/', (req: Request, res: Response) => {
  const status = req.query.status as string | undefined
  const data = svc.listHospitalizations(status)
  res.json({ success: true, data })
})

router.get('/:id', (req: Request, res: Response) => {
  const data = svc.getHospitalizationById(req.params.id)
  if (!data) {
    res.status(404).json({ success: false, error: '住院记录不存在' })
    return
  }
  res.json({ success: true, data })
})

router.post('/', (req: Request, res: Response) => {
  const data = svc.createHospitalization(req.body)
  res.status(201).json({ success: true, data })
})

router.put('/:id', (req: Request, res: Response) => {
  const data = svc.updateHospitalization(req.params.id, req.body)
  if (!data) {
    res.status(404).json({ success: false, error: '住院记录不存在' })
    return
  }
  res.json({ success: true, data })
})

router.post('/:id/discharge', (req: Request, res: Response) => {
  const result = svc.dischargeHospitalization(req.params.id) as any
  if (!result) {
    res.status(404).json({ success: false, error: '住院记录不存在' })
    return
  }
  if (result.error) {
    res.status(400).json({ success: false, error: result.error })
    return
  }
  res.json({ success: true, data: result })
})

router.post('/:id/critical', (req: Request, res: Response) => {
  const { marked_by } = req.body
  const result = criticalSvc.markCritical(req.params.id, marked_by) as any
  if (!result) {
    res.status(404).json({ success: false, error: '住院记录不存在' })
    return
  }
  if (result.error) {
    res.status(400).json({ success: false, error: result.error })
    return
  }
  res.json({ success: true, data: result })
})

router.delete('/:id/critical', (req: Request, res: Response) => {
  const result = criticalSvc.unmarkCritical(req.params.id) as any
  if (!result) {
    res.status(404).json({ success: false, error: '住院记录不存在' })
    return
  }
  if (result.error) {
    res.status(400).json({ success: false, error: result.error })
    return
  }
  res.json({ success: true, data: result })
})

router.get('/:id/critical-observations', (req: Request, res: Response) => {
  const data = criticalSvc.listCriticalObservations(req.params.id)
  res.json({ success: true, data })
})

router.post('/:id/critical-observations', (req: Request, res: Response) => {
  const result = criticalSvc.createCriticalObservation(req.body) as any
  if (!result) {
    res.status(404).json({ success: false, error: '住院记录不存在' })
    return
  }
  if (result.error) {
    res.status(400).json({ success: false, error: result.error })
    return
  }
  res.status(201).json({ success: true, data: result })
})

router.post('/:id/critical-observations/supplement', (req: Request, res: Response) => {
  const result = criticalSvc.supplementCriticalObservation(req.body) as any
  if (!result) {
    res.status(404).json({ success: false, error: '住院记录不存在' })
    return
  }
  if (result.error) {
    res.status(400).json({ success: false, error: result.error })
    return
  }
  res.status(201).json({ success: true, data: result })
})

router.get('/:id/medication-tasks', (req: Request, res: Response) => {
  const status = req.query.status as string | undefined
  const data = medTaskSvc.listMedicationTasks(req.params.id, status)
  res.json({ success: true, data })
})

export default router
