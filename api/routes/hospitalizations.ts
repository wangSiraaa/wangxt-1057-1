import { Router, type Request, type Response } from 'express'
import * as svc from '../services/hospitalizationService.js'

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

export default router
