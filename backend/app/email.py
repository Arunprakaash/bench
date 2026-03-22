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
    subject = f"You've been invited to join {workspace_name} on Bench"
    plain = (
        f"Hi,\n\n"
        f"{inviter_name} has invited you to join the workspace \"{workspace_name}\" on Bench as a {role}.\n\n"
        f"Accept your invitation:\n{invite_url}\n\n"
        f"If you don't have a Bench account yet, you'll be prompted to create one.\n\n"
        f"— The Bench team"
    )
    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#111;">
  <div style="text-align:center;margin-bottom:24px;">
    <span style="display:inline-block;background:#f0f4ff;border-radius:12px;padding:12px 16px;font-size:24px;">⚗️</span>
    <h1 style="font-size:20px;margin:12px 0 4px;">You've been invited to Bench</h1>
  </div>
  <p style="color:#444;">{inviter_name} has invited you to join <strong>{workspace_name}</strong> as a <strong>{role}</strong>.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="{invite_url}"
       style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
      Accept invitation
    </a>
  </div>
  <p style="color:#888;font-size:13px;">
    If you don't have a Bench account yet, you'll be prompted to create one first.<br><br>
    Or copy this link: <a href="{invite_url}" style="color:#4f46e5;">{invite_url}</a>
  </p>
</body>
</html>
"""
    return subject, html, plain
