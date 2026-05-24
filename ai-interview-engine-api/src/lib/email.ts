import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASSWORD,
  },
})

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

export async function sendInterviewInvite(params: {
  candidateEmail: string
  jobTitle: string
  interviewId: string
}): Promise<void> {
  const { candidateEmail, jobTitle, interviewId } = params
  const interviewUrl = `${FRONTEND_URL}/interview/${interviewId}`

  await transporter.sendMail({
    from: `"AI Interview Engine" <${process.env.GMAIL_USER}>`,
    to: candidateEmail,
    subject: `You've been invited to interview for ${jobTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #111;">
        <h2 style="margin: 0 0 8px;">You're invited to interview</h2>
        <p style="color: #555; margin: 0 0 24px;">
          You've been selected to interview for the <strong>${jobTitle}</strong> role.
          The interview is conducted by Alex, an AI interviewer — it takes around 10 minutes
          and you can do it from anywhere.
        </p>

        <a href="${interviewUrl}"
           style="display: inline-block; background: #4f46e5; color: #fff; text-decoration: none;
                  font-weight: 600; padding: 12px 24px; border-radius: 8px; margin-bottom: 24px;">
          Start Interview
        </a>

        <p style="color: #888; font-size: 13px; margin: 0 0 4px;">Or copy this link:</p>
        <p style="color: #555; font-size: 13px; word-break: break-all; margin: 0 0 32px;">
          ${interviewUrl}
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 24px;" />

        <p style="color: #aaa; font-size: 12px; margin: 0;">
          You can upload your resume at the start of the interview so the interviewer
          can ask questions tailored to your background.
        </p>
      </div>
    `,
  })

  console.log(`[email] invite sent to ${candidateEmail} for interview ${interviewId}`)
}
