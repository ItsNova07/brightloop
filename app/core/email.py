"""Shared email helper (Mailpit locally). Member 4 can reuse send_email() for invoices."""
import logging
import smtplib
from email.message import EmailMessage

from .config import get_settings

log = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str,
               attachments: list[tuple[str, bytes, str]] | None = None) -> bool:
    """Send a plain-text email. attachments = [(filename, bytes, "application/pdf"), ...].
    Never raises; returns True on success so callers can record a failed send."""
    s = get_settings()
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = subject, s.mail_from, to
    msg.set_content(body)
    for filename, data, mime in attachments or []:
        maintype, _, subtype = mime.partition("/")
        msg.add_attachment(data, maintype=maintype, subtype=subtype or "octet-stream", filename=filename)
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=5) as smtp:
            smtp.send_message(msg)
        return True
    except Exception:
        log.exception("Could not send email to %s", to)
        return False
