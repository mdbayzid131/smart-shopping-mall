import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import dns from 'node:dns';
import config from '../config';
import { errorLogger, logger } from '../shared/logger';
import { ISendEmail } from '../types/email';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

const isSecure = Number(config.email.port) === 465;

const transporter = nodemailer.createTransport({
  host: config.email.host || 'smtp.gmail.com',
  port: Number(config.email.port) || 465,
  secure: isSecure,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
  lookup: (hostname: string, options: any, callback: any) => {
    const cb = typeof options === 'function' ? options : callback;
    dns.lookup(hostname, { family: 4 }, cb);
  },
  tls: {
    rejectUnauthorized: false,
    servername: config.email.host || 'smtp.gmail.com',
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
} as any);

transporter.verify((error, success) => {
  if (error) {
    errorLogger.error(`[EMAIL] SMTP configuration verification failed: ${error.message}`);
  } else {
    logger.info('[EMAIL] SMTP Server is ready to send messages');
  }
});

const sendEmail = async (values: ISendEmail) => {
  try {
    const info = await transporter.sendMail({
      from: `"${config.branding.projectName}" <${config.email.from}>`,
      to: values.to,
      subject: values.subject,
      text: values.text,
      html: values.html,
      envelope: {
        from: config.email.from,
        to: values.to,
      },
      headers: {
        'Auto-Submitted': 'auto-generated',
        'X-Entity-Ref-ID': crypto.randomUUID(),
      },
    });

    logger.info(`[EMAIL] Mail sent successfully to ${values.to}`, info.accepted);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorLogger.error(`[EMAIL] Delivery failed to ${values.to}: ${message}`, error);
    throw error;
  }
};

export const emailHelper = {
  sendEmail,
};
