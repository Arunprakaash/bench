"""
Simple SMTP email sender. Uses stdlib smtplib wrapped in asyncio.to_thread.
Configure via SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM in .env.
If SMTP_HOST is empty, sending is skipped (invite link still works, just not emailed).
"""
import asyncio
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def _send_sync(to: str, subject: str, html: str, text: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()
        if settings.smtp_user and settings.smtp_password:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.sendmail(msg["From"], [to], msg.as_string())


async def send_email(to: str, subject: str, html: str, text: str) -> bool:
    """Send an email. Returns True on success, False if SMTP not configured or on error."""
    if not settings.smtp_host:
        logger.info("SMTP not configured — skipping email to %s", to)
        return False
    try:
        await asyncio.to_thread(_send_sync, to, subject, html, text)
        logger.info("Email sent to %s: %s", to, subject)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)
        return False


def invite_email(workspace_name: str, role: str, invite_url: str, inviter_name: str) -> tuple[str, str, str]:
    """Returns (subject, html, plain_text) for a workspace invite email."""
    subject = f"Join {workspace_name} on Bench"
    plain = (
        f"Hi,\n\n"
        f"{inviter_name} invited you to join \"{workspace_name}\" on Bench as a {role}.\n\n"
        f"Accept your invitation:\n{invite_url}\n\n"
        f"If you don't have a Bench account yet, you'll be prompted to create one first.\n\n"
        f"— Bench"
    )
    html = f"""<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
    </head>
    <body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">

              <!-- Logo + heading -->
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;background:#eef2ff;border:1px solid #c7d2fe;margin-bottom:16px;">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                      <circle cx="6.5" cy="6.5" r="2.7" fill="#4f46e5"/>
                      <circle cx="17.5" cy="6.5" r="2.7" fill="#4f46e5"/>
                      <circle cx="12" cy="17.5" r="2.7" fill="#4f46e5"/>
                      <path d="M8.5 8.2L10.5 12.2M15.5 8.2L13.5 12.2M9.8 15.4H14.2" stroke="#4f46e5" stroke-width="2.2" stroke-linecap="round"/>
                    </svg>
                  </div>

                  <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f0f0f;letter-spacing:-0.3px;">
                    You're invited to join {workspace_name}
                  </h1>
                </td>
              </tr>

              <!-- Card -->
              <tr>
                <td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">

                  <!-- Single clean sentence -->
                  <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">
                    <strong style="color:#111827;">{inviter_name}</strong> invited you to join
                    <strong style="color:#111827;">{workspace_name}</strong> on Bench as a
                    <strong style="color:#111827;">{role}</strong>.
                  </p>

                  <!-- CTA -->
                  <div style="text-align:center;margin-bottom:16px;">
                    <a href="{invite_url}"
                       style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:11px 32px;border-radius:8px;font-weight:600;font-size:14px;letter-spacing:0.01em;">
                      Join workspace
                    </a>
                  </div>

                  <!-- Trust signal -->
                  <p style="margin:0 0 20px;font-size:12px;color:#9ca3af;text-align:center;">
                    Invitation sent by {inviter_name}
                  </p>

                  <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;">

                  <!-- Footer copy -->
                  <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                    You’ll be asked to sign in or create an account.<br>
                    Or copy this link:
                    <a href="{invite_url}" style="color:#4f46e5;word-break:break-all;">
                      {invite_url}
                    </a>
                  </p>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" style="padding-top:20px;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;">
                    Bench — Test and evaluate AI agents with confidence
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>"""
    return subject, html, plain
