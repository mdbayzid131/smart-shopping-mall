import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import config from '../config';
import { errorLogger, logger } from '../shared/logger';
import { ISendEmail } from '../types/email';

const isGmail = config.email.host?.toLowerCase().includes('gmail');
const isSecure = Number(config.email.port) === 465;

const transporter = nodemailer.createTransport({
  ...(isGmail
    ? { service: 'gmail' }
    : {
        host: config.email.host,
        port: Number(config.email.port),
        secure: isSecure,
      }),
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

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
