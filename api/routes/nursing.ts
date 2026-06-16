import { Router, type Request, type Response } from 'express'
import * as svc from '../services/nursingService.js'

const router = Router()

router.get('/:hospitalizationId/nursing-records', (req: Request, res: Response) => {
  const data = svc.listNursingRecords(req.params.hospitalizationId)
  res.json({ success: true, data })
})

router.post('/:hospitalizationId/nursing-records', (req: Request, res: Response) => {
  const result = svc.createNursingRecord(req.params.hospitalizationId, req.body) as any
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

router.put('/nursing-records/:recordId', (req: Request, res: Response) => {
  const data = svc.updateNursingRecord(req.params.recordId, req.body)
  if (!data) {
    res.status(404).json({ success: false, error: '护理记录不存在' })
    return
  }
  res.json({ success: true, data })
})

export default router
