import express from 'express'
import cors from 'cors'
import interviewRoutes from './routes/interview'
import recruiterRoutes from './routes/recruiter'

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

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
