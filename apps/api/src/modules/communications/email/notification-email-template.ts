// ---------------------------------------------------------------------------
// Notification Email HTML Template — Renders styled HTML emails for
// notification delivery, following Concept D design system.
// E9-3 Task 3.1
// ---------------------------------------------------------------------------

import sanitize from 'sanitize-html';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NotificationEmailData {
  title: string;
  body: string;
  actionUrl: string | null;
  actionLabel?: string;
  companyName?: string;
  logoUrl?: string | null;
  unsubscribeHint?: string;
}

// ─── Renderers ──────────────────────────────────────────────────────────────

/**
 * Renders a complete HTML email document for a notification.
 *
 * All CSS is inlined directly on elements (no `<style>` blocks) for maximum
 * email client compatibility (Gmail, Outlook, Apple Mail, etc.).
 *
 * Layout: centred 600px container, purple accent header, white body card,
 * optional CTA button, muted footer.
 */
export function renderNotificationEmailHtml(data: NotificationEmailData): string {
  const companyName = data.companyName || 'Nexa ERP';
  const actionLabel = data.actionLabel || 'View Details';
  const unsubscribeHint =
    data.unsubscribeHint || 'Manage your notification preferences in Settings';

  const logoHtml = data.logoUrl
    ? `<img src="${escapeAttr(data.logoUrl)}" alt="${escapeAttr(companyName)} logo" style="max-height:36px;max-width:180px;display:block;" />`
    : `<span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${escapeHtml(companyName)}</span>`;

  const actionButtonHtml = data.actionUrl
    ? `
            <tr>
              <td style="padding:24px 0 0 0;" align="center">
                <a href="${escapeAttr(data.actionUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#7c3aed;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;mso-padding-alt:0;text-align:center;">
                  <!--[if mso]><i style="letter-spacing:32px;mso-font-width:-100%;mso-text-raise:24pt">&nbsp;</i><![endif]-->
                  ${escapeHtml(actionLabel)}
                  <!--[if mso]><i style="letter-spacing:32px;mso-font-width:-100%">&nbsp;</i><![endif]-->
                </a>
              </td>
            </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(data.title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f2ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f2ff;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <!-- Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#7c3aed;padding:16px 24px;border-radius:12px 12px 0 0;" align="left">
              ${logoHtml}
            </td>
          </tr>
          <!-- Body Card -->
          <tr>
            <td style="background-color:#ffffff;padding:32px 24px;border-radius:0 0 12px 12px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <!-- Title -->
                <tr>
                  <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:22px;font-weight:700;color:#1e1b4b;line-height:1.3;padding:0 0 16px 0;">
                    ${escapeHtml(data.title)}
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;color:#4b5563;line-height:1.6;">
                    ${sanitizeBody(data.body)}
                  </td>
                </tr>
                <!-- Action Button -->
                ${actionButtonHtml}
              </table>
            </td>
          </tr>
          <!-- Spacer -->
          <tr>
            <td style="height:16px;"></td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 24px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#9ca3af;line-height:1.5;text-align:center;padding:0 0 8px 0;">
                    ${escapeHtml(unsubscribeHint)}
                  </td>
                </tr>
                <tr>
                  <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#9ca3af;line-height:1.5;text-align:center;padding:0 0 24px 0;">
                    Powered by Nexa ERP
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Renders a plain text fallback for the notification email.
 */
export function renderNotificationEmailText(
  data: Pick<NotificationEmailData, 'title' | 'body' | 'actionUrl'>,
): string {
  const lines = [data.title, '', stripHtml(data.body)];
  if (data.actionUrl) {
    lines.push('', data.actionUrl);
  }
  return lines.join('\n');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitises HTML for safe email embedding using sanitize-html library.
 * Allows only safe formatting tags and attributes; strips everything else
 * including scripts, iframes, event handlers, and dangerous URL schemes.
 */
function sanitizeBody(html: string): string {
  return sanitize(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'a',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'span',
      'div',
      'blockquote',
      'hr',
      'table',
      'thead',
      'tbody',
      'tr',
      'td',
      'th',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      td: ['align', 'valign'],
      th: ['align', 'valign'],
      span: ['style'],
      p: ['style'],
      div: ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedStyles: {
      '*': {
        color: [/.*/],
        'font-weight': [/.*/],
        'font-style': [/.*/],
        'text-align': [/.*/],
        'text-decoration': [/.*/],
      },
    },
  });
}

function stripHtml(html: string): string {
  // Insert line breaks at block boundaries before stripping tags
  return html
    .replace(/<\/(?:p|div|li|h[1-6]|tr|br)\s*\/?>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
