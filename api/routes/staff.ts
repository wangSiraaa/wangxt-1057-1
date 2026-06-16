import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const data = db.prepare('SELECT * FROM staff ORDER BY created_at').all()
  res.json({ success: true, data })
})

export default router
