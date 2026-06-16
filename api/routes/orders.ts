import { Router, type Request, type Response } from 'express'
import * as svc from '../services/orderService.js'

const router = Router()

router.get('/:hospitalizationId/orders', (req: Request, res: Response) => {
  const data = svc.listOrders(req.params.hospitalizationId)
  res.json({ success: true, data })
})

router.post('/:hospitalizationId/orders', (req: Request, res: Response) => {
  const data = svc.createOrder(req.params.hospitalizationId, req.body)
  if (!data) {
    res.status(404).json({ success: false, error: '住院记录不存在' })
    return
  }
  res.status(201).json({ success: true, data })
})

router.put('/orders/:orderId', (req: Request, res: Response) => {
  const data = svc.updateOrder(req.params.orderId, req.body)
  if (!data) {
    res.status(404).json({ success: false, error: '医嘱不存在' })
    return
  }
  res.json({ success: true, data })
})

router.post('/orders/:orderId/confirm', (req: Request, res: Response) => {
  const { confirmed_by } = req.body
  const result = svc.confirmOrder(req.params.orderId, confirmed_by) as any
  if (!result) {
    res.status(404).json({ success: false, error: '医嘱不存在' })
    return
  }
  if (result.error) {
    res.status(400).json({ success: false, error: result.error })
    return
  }
  res.json({ success: true, data: result })
})

router.post('/orders/:orderId/stop', (req: Request, res: Response) => {
  const { reason } = req.body
  const result = svc.stopOrder(req.params.orderId, reason) as any
  if (!result) {
    res.status(404).json({ success: false, error: '医嘱不存在' })
    return
  }
  if (result.error) {
    res.status(400).json({ success: false, error: result.error })
    return
  }
  res.json({ success: true, data: result })
})

export default router
