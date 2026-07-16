import { config } from "../lib/config";
import { logger } from "../lib/logger";

export type PasswordResetEmail = { email: string; customerName: string; token: string };

export interface MailAdapter {
  sendPasswordReset(input: PasswordResetEmail): Promise<void>;
}

function resetUrl(token: string): string {
  return new URL(`/reset-password?token=${encodeURIComponent(token)}`, config.PUBLIC_SITE_URL).toString();
}

export class DevelopmentMailAdapter implements MailAdapter {
  async sendPasswordReset(input: PasswordResetEmail): Promise<void> {
    if (config.isProduction) throw new Error("Development mail adapter cannot run in production");
    logger.info({ recipient: input.email, resetUrl: resetUrl(input.token) }, "Development password reset email");
  }
}

export class ResendMailAdapter implements MailAdapter {
  async sendPasswordReset(input: PasswordResetEmail): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${config.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: config.EMAIL_FROM,
        to: [input.email],
        subject: "إعادة تعيين كلمة المرور | مكتبة دوت كوم",
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8"><h2>مرحبًا ${escapeHtml(input.customerName)}</h2><p>تلقينا طلبًا لإعادة تعيين كلمة المرور. الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة فقط.</p><p><a href="${escapeHtml(resetUrl(input.token))}">إعادة تعيين كلمة المرور</a></p><p>إذا لم تطلب ذلك، يمكنك تجاهل الرسالة.</p></div>`,
      }),
    });
    if (!response.ok) throw new Error(`Email provider rejected the request (${response.status})`);
  }
}

class DisabledMailAdapter implements MailAdapter {
  async sendPasswordReset(): Promise<void> {
    throw new Error("Email provider is disabled");
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

export const mailAdapter: MailAdapter = config.EMAIL_PROVIDER === "resend"
  ? new ResendMailAdapter()
  : config.EMAIL_PROVIDER === "disabled" ? new DisabledMailAdapter() : new DevelopmentMailAdapter();
