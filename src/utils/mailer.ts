import nodemailer, { type Transporter } from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

const SUBJECT = 'Recuperá tu contraseña — Estelares Futsal';

function buildHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#000000;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#000000;border:1px solid #1a1a1a;border-radius:12px;padding:32px;">
            <tr>
              <td align="center" style="padding-bottom:8px;">
                <span style="font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-size:30px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#f5f5f5;">
                  Estelares <span style="color:#DC2626;">Futsal</span>
                </span>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="height:2px;width:64px;background-color:#C9A84C;"></div>
              </td>
            </tr>
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#f5f5f5;padding-bottom:20px;">
                Recibimos un pedido para restablecer la contraseña de tu cuenta.
                Hacé clic en el botón para elegir una nueva. El enlace vence en <strong style="color:#C9A84C;">1 hora</strong>.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 0 24px 0;">
                <a href="${resetUrl}" style="display:inline-block;background-color:#DC2626;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:14px 32px;border-radius:8px;">
                  Restablecer contraseña
                </a>
              </td>
            </tr>
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#9a9a9a;padding-bottom:8px;">
                Si el botón no funciona, copiá y pegá este enlace en tu navegador:
              </td>
            </tr>
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#C9A84C;word-break:break-all;padding-bottom:24px;">
                ${resetUrl}
              </td>
            </tr>
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#9a9a9a;padding-bottom:24px;">
                Si no pediste este cambio, podés ignorar este mensaje: tu contraseña actual sigue activa.
              </td>
            </tr>
            <tr>
              <td align="center" style="border-top:1px solid #1a1a1a;padding-top:20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:1px;color:#6b6b6b;">
                Estelares Futsal · Temporada 2026
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildText(resetUrl: string): string {
  return [
    'ESTELARES FUTSAL',
    '',
    'Recibimos un pedido para restablecer la contraseña de tu cuenta.',
    'Abrí el siguiente enlace para elegir una nueva. Vence en 1 hora:',
    '',
    resetUrl,
    '',
    'Si no pediste este cambio, podés ignorar este mensaje: tu contraseña actual sigue activa.',
    '',
    'Estelares Futsal · Temporada 2026',
  ].join('\n');
}

export async function sendPasswordReset(to: string, resetUrl: string): Promise<void> {
  const tx = getTransporter();
  if (!tx) {
    console.warn('GMAIL_USER / GMAIL_APP_PASSWORD no configurados: email de reset no enviado');
    return;
  }
  await tx.sendMail({
    from: `"Estelares Futsal" <${GMAIL_USER}>`,
    to,
    subject: SUBJECT,
    text: buildText(resetUrl),
    html: buildHtml(resetUrl),
  });
}
