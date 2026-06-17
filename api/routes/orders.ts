import { Router, type Request, type Response } from 'express'
import * as svc from '../services/orderService.js'
import * as medTaskSvc from '../services/medicationTaskService.js'

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
  const { confirmed_by, stock_quantity } = req.body
  const result = svc.confirmOrder(req.params.orderId, confirmed_by, stock_quantity) as any
  if (!result) {
    res.status(404).json({ success: false, error: '医嘱不存在' })
    return
  }
  if (result.error) {
    res.status(400).json({ success: false, error: result.error })
    return
  }
  const responseData: any = { order: result.order }
  if (result.medicationTask) {
    responseData.medicationTask = result.medicationTask
  }
  res.json({ success: true, data: responseData })
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

router.post('/orders/:orderId/check-stock', (req: Request, res: Response) => {
  const { medication_name, required_quantity, stock_quantity } = req.body
  const result = medTaskSvc.checkStockAndCreateTask(
    req.params.orderId,
    medication_name,
    parseFloat(required_quantity),
    parseFloat(stock_quantity)
  ) as any
  if (result.error) {
    res.status(400).json({ success: false, error: result.error })
    return
  }
  res.json({ success: true, data: result })
})

router.get('/medication-tasks', (req: Request, res: Response) => {
  const status = req.query.status as string | undefined
  const data = medTaskSvc.listMedicationTasks(undefined, status)
  res.json({ success: true, data })
})

router.get('/medication-tasks/:taskId', (req: Request, res: Response) => {
  const data = medTaskSvc.getMedicationTask(req.params.taskId)
  if (!data) {
    res.status(404).json({ success: false, error: '补药任务不存在' })
    return
  }
  res.json({ success: true, data })
})

router.put('/medication-tasks/:taskId', (req: Request, res: Response) => {
  const data = medTaskSvc.updateMedicationTask(req.params.taskId, req.body)
  if (!data) {
    res.status(404).json({ success: false, error: '补药任务不存在' })
    return
  }
  res.json({ success: true, data })
})

router.post('/medication-tasks/:taskId/complete', (req: Request, res: Response) => {
  const { notes } = req.body
  const result = medTaskSvc.completeMedicationTask(req.params.taskId, notes) as any
  if (!result) {
    res.status(404).json({ success: false, error: '补药任务不存在' })
    return
  }
  if (result.error) {
    res.status(400).json({ success: false, error: result.error })
    return
  }
  res.json({ success: true, data: result })
})

export default router
