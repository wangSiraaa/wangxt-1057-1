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

router.post('/billing/:itemId/terminate', (req: Request, res: Response) => {
  const { reason, termination_category } = req.body
  const result = svc.terminateBillingItem(req.params.itemId, reason, termination_category) as any
  if (!result) {
    res.status(404).json({ success: false, error: '费用项目不存在' })
    return
  }
  if (result.error) {
    res.status(400).json({ success: false, error: result.error })
    return
  }
  res.json({ success: true, data: result })
})

router.post('/nursing-records/:recordId/terminate', (req: Request, res: Response) => {
  const { reason, termination_category } = req.body
  const result = svc.terminateNursingRecord(req.params.recordId, reason, termination_category) as any
  if (!result) {
    res.status(404).json({ success: false, error: '护理记录不存在' })
    return
  }
  if (result.error) {
    res.status(400).json({ success: false, error: result.error })
    return
  }
  res.json({ success: true, data: result })
})

router.get('/:hospitalizationId/closure-summary', (req: Request, res: Response) => {
  const data = svc.getDischargeClosureSummary(req.params.hospitalizationId)
  if (!data) {
    res.status(404).json({ success: false, error: '住院记录不存在' })
    return
  }
  res.json({ success: true, data })
})

router.post('/:hospitalizationId/settle', (req: Request, res: Response) => {
  const { early_discharge_reason } = req.body
  const result = svc.settleAndDischarge(req.params.hospitalizationId, early_discharge_reason) as any
  if (!result) {
    res.status(404).json({ success: false, error: '住院记录不存在' })
    return
  }
  if (result.error) {
    res.status(400).json({ success: false, error: result.error, closure: result.closure })
    return
  }
  res.json({ success: true, data: result })
})

export default router
