import { Router, type Request, type Response } from 'express'
import * as svc from '../services/billingService.js'

const router = Router()

router.get('/:hospitalizationId/billing', (req: Request, res: Response) => {
  const data = svc.listBillingItems(req.params.hospitalizationId)
  res.json({ success: true, data })
})

router.post('/:hospitalizationId/billing', (req: Request, res: Response) => {
  const data = svc.createBillingItem(req.params.hospitalizationId, req.body)
  if (!data) {
    res.status(404).json({ success: false, error: '住院记录不存在' })
    return
  }
  res.status(201).json({ success: true, data })
})

router.post('/:hospitalizationId/settle', (req: Request, res: Response) => {
  const result = svc.settleAndDischarge(req.params.hospitalizationId)
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
