import { Router, type Request, type Response } from 'express'
import * as svc from '../services/shiftService.js'

const router = Router()

router.get('/current', (_req: Request, res: Response) => {
  const data = svc.getCurrentShift()
  res.json({ success: true, data })
})

router.post('/handover', (req: Request, res: Response) => {
  const result = svc.handover(req.body) as any
  if (result.error) {
    res.status(400).json({ success: false, error: result.error, checklist: result.checklist })
    return
  }
  res.status(201).json({ success: true, data: result })
})

router.get('/:id/summary', (req: Request, res: Response) => {
  const data = svc.getShiftSummary(req.params.id)
  if (!data) {
    res.status(404).json({ success: false, error: '班次不存在' })
    return
  }
  res.json({ success: true, data })
})

router.get('/:id/handover-checklist', (req: Request, res: Response) => {
  const data = svc.getHandoverChecklist(req.params.id)
  res.json({ success: true, data })
})

export default router
