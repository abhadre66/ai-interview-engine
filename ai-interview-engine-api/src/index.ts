import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import interviewRoutes from './routes/interview'
import recruiterRoutes from './routes/recruiter'
import resumeRoutes from './routes/resume'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/interview', interviewRoutes)
app.use('/api/recruiter', recruiterRoutes)
app.use('/api/resume', resumeRoutes)

// Global error handler — catches any unhandled async errors in route handlers
// Without this, Express 4 drops the connection silently → browser sees "Failed to fetch"
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err.message)
  res.status(500).json({ error: err.message ?? 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
