import config from '../config';
import crypto from 'node:crypto';
import {
  ICreateAccount,
  ILoginOtp,
  IReportStatusEmail,
  IResetPassword,
} from '../types/emailTamplate';

const getProjectName = () => config.branding.projectName;

const getLogoUrl = () =>
  config.branding.logoUrl ||
  `${config.api_public_url}/uploads/closet_logo.svg`;

const uniqueTransactionalSubject = (subject: string) =>
  `${subject} ${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    character =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] as string,
  );

const baseTemplate = (title: string, bodyContent: string) => {
  const projectName = getProjectName();
  const logoUrl = getLogoUrl();
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&display=swap" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #f4f4f5;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }


      .wrapper {
        width: 100%;
        table-layout: fixed;
        background-color: #f4f4f5;
        padding: 32px 0;
      }


      .main {
        width: 100%;
        max-width: 480px;
        margin: 0 auto;
        background-color: #0E0F12;
        border-radius: 20px;
        border: 1px solid #1F2229;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #e5e7eb;
        overflow: hidden;
      }


      .header {
        padding: 32px 24px 20px;
        text-align: center;
        background: #0E0F12;
      }


      .brand-name {
        font-family: Georgia, Cambria, 'Times New Roman', Times, serif;
        font-size: 30px;
        line-height: 36px;
        font-weight: normal;
        letter-spacing: 0.025em;
        color: #E2B744;
        background: linear-gradient(99.37deg, #AF7413 4.77%, #C98C28 19.33%, #E2B744 38.93%, #FFED81 50.54%, #E1C24E 62.1%, #A06008 90.74%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        display: inline-block;
        text-align: center;
        margin: 0 auto;
      }


      .logo {
        display: block;
        margin: 0 auto 20px;
        max-width: 140px;
        height: auto;
      }


      .content {
        padding: 12px 28px 28px;
        font-size: 14px;
        line-height: 1.6;
        text-align: center;
      }


      .content-title {
        font-size: 22px;
        font-weight: 600;
        margin: 0 0 14px;
        color: #f9fafb;
      }


      .otp-box {
        display: inline-block;
        margin: 20px 0 10px;
        padding: 14px 38px;
        border-radius: 9999px;
        background: #E2B744;
        background: linear-gradient(99.37deg, #AF7413 4.77%, #C98C28 19.33%, #E2B744 38.93%, #FFED81 50.54%, #E1C24E 62.1%, #A06008 90.74%);
        color: #000000;
        font-size: 26px;
        font-weight: 700;
        letter-spacing: 0.22em;
        box-shadow: 0 4px 16px rgba(214, 160, 66, 0.25);
      }


      .footer {
        padding: 20px 24px 28px;
        font-size: 12px;
        color: #9ca3af;
        text-align: center;
        border-top: 1px solid #1F2229;
        background: #090A0D;
      }


      @media screen and (max-width: 600px) {
        .main {
          max-width: 100%;
          border-radius: 0;
          border-left: none;
          border-right: none;
        }


        .content {
          padding: 8px 18px 24px;
        }
      }
    </style>
  </head>
  <body>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="wrapper">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="main">
            <tr>
              <td class="header" style="padding: 32px 24px 20px; text-align: center; background: #0E0F12;">
                ${
                  logoUrl
                    ? `<img src="${logoUrl}" alt="${projectName}" width="160" height="46" class="logo" style="display: block; margin: 0 auto; width: 160px; max-width: 160px; height: auto; border: 0; outline: none; text-decoration: none;" />`
                    : `<span class="brand-name" style="font-family: Georgia, Cambria, 'Times New Roman', Times, serif; font-size: 30px; line-height: 36px; font-weight: normal; letter-spacing: 0.025em; color: #E2B744; background: linear-gradient(99.37deg, #AF7413 4.77%, #C98C28 19.33%, #E2B744 38.93%, #FFED81 50.54%, #E1C24E 62.1%, #A06008 90.74%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; display: inline-block; text-align: center;">${projectName}</span>`
                }
              </td>
            </tr>
            <tr>
              <td class="content">
                <h1 class="content-title" style="color: #ffffff; font-size: 22px; font-weight: 600; margin: 0 0 14px;">${title}</h1>
                ${bodyContent}
              </td>
            </tr>
            <tr>
              <td class="footer" style="padding: 20px 24px 28px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #1F2229; background: #090A0D;">
                <div style="color: #9ca3af; font-size: 12px; margin-bottom: 4px;">${projectName} · Verified Luxury Resale Marketplace</div>
                <div style="color: #6b7280; font-size: 11px; margin-bottom: 4px;">Dubai, United Arab Emirates</div>
                <div style="color: #6b7280; font-size: 11px;">© ${year} ${projectName}. All rights reserved.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const createAccount = (values: ICreateAccount) => {
  const projectName = getProjectName();

  const bodyContent = `
    <p style="margin: 0 0 10px; color: #d1d5db;">
      Hey ${values.name}, use the one-time passcode below to complete verification of your ${projectName} account.
    </p>
    <div class="otp-box" style="display: inline-block; margin: 20px 0 10px; padding: 14px 38px; border-radius: 9999px; background: #E2B744; background: linear-gradient(99.37deg, #AF7413 4.77%, #C98C28 19.33%, #E2B744 38.93%, #FFED81 50.54%, #E1C24E 62.1%, #A06008 90.74%); color: #000000; font-size: 26px; font-weight: 700; letter-spacing: 0.22em; box-shadow: 0 4px 16px rgba(214, 160, 66, 0.25);">${values.otp}</div>
    <p style="margin: 8px 0 4px; color: #9ca3af;">
      Code expires in 3 minutes.
    </p>
    <p style="margin: 16px 0 0; color: #6b7280;">
      If you did not request this, ignore this email.
    </p>
  `;

  const data = {
    to: values.email,
    subject: `${values.otp} is your ${projectName} verification code`,
    text: `Hi ${values.name},\n\nYour ${projectName} verification code is ${values.otp}.\n\nThis code expires in 3 minutes. If you did not request it, you can ignore this email.`,
    html: baseTemplate('Verify your account', bodyContent),
  };

  return data;
};

const resetPassword = (values: IResetPassword) => {
  const projectName = getProjectName();

  const bodyContent = `
    <p style="margin: 0 0 10px; color: #d1d5db;">
      Use the one-time passcode below to reset the password for your ${projectName} account.
    </p>
    <div class="otp-box" style="display: inline-block; margin: 20px 0 10px; padding: 14px 38px; border-radius: 9999px; background: #E2B744; background: linear-gradient(99.37deg, #AF7413 4.77%, #C98C28 19.33%, #E2B744 38.93%, #FFED81 50.54%, #E1C24E 62.1%, #A06008 90.74%); color: #000000; font-size: 26px; font-weight: 700; letter-spacing: 0.22em; box-shadow: 0 4px 16px rgba(214, 160, 66, 0.25);">${values.otp}</div>
    <p style="margin: 8px 0 4px; color: #9ca3af;">
      Code expires in 3 minutes.
    </p>
    <p style="margin: 16px 0 0; color: #6b7280;">
      If you did not request this, ignore this email.
    </p>
  `;

  const data = {
    to: values.email,
    subject: `${values.otp} is your ${projectName} password reset code`,
    text: `Your ${projectName} password reset code is ${values.otp}.\n\nThis code expires in 3 minutes. If you did not request it, you can ignore this email.`,
    html: baseTemplate('Reset your password', bodyContent),
  };

  return data;
};

const loginOtp = (values: ILoginOtp) => {
  const projectName = getProjectName();

  const bodyContent = `
    <p style="margin: 0 0 10px; color: #d1d5db;">
        Hey ${values.name || 'there'}, use the one-time passcode below to sign in to your ${projectName} account.
    </p>
    <div class="otp-box" style="display: inline-block; margin: 20px 0 10px; padding: 14px 38px; border-radius: 9999px; background: #E2B744; background: linear-gradient(99.37deg, #AF7413 4.77%, #C98C28 19.33%, #E2B744 38.93%, #FFED81 50.54%, #E1C24E 62.1%, #A06008 90.74%); color: #000000; font-size: 26px; font-weight: 700; letter-spacing: 0.22em; box-shadow: 0 4px 16px rgba(214, 160, 66, 0.25);">${values.otp}</div>
    <p style="margin: 8px 0 4px; color: #9ca3af;">
      Code expires in 5 minutes and can only be used once.
    </p>
    <p style="margin: 16px 0 0; color: #6b7280;">
      If you did not request this, ignore this email and your account will remain secure.
    </p>
  `;

  const data = {
    to: values.email,
    subject: `${values.otp} is your ${projectName} sign-in code`,
    text: `Hi ${values.name || 'there'},\n\nYour ${projectName} sign-in code is ${values.otp}.\n\nThis code expires in 5 minutes and can only be used once. If you did not request it, you can ignore this email.`,
    html: baseTemplate('Sign in to your account', bodyContent),
  };

  return data;
};

const reportStatusUpdate = (values: IReportStatusEmail) => {
  const projectName = getProjectName();

  const decisionLabel =
    values.decision === 'resolved' ? 'Report Resolved' : 'Report Dismissed';

  const bodyContent = `
    <p style="margin: 0 0 10px; color: #d1d5db;">
      We are writing to inform you about the outcome of a report related to your activity on ${projectName}.
    </p>
    <p style="margin: 8px 0; color: #d1d5db;">
      Status: <strong style="color: #f9fafb;">${decisionLabel}</strong>
    </p>
    <p style="margin: 8px 0; color: #d1d5db;">
      Explanation from our team:
    </p>
    <p style="margin: 8px 0 16px; color: #9ca3af;">
      ${values.explanation}
    </p>
    ${
      values.productName || values.productId
        ? `
    <div style="margin: 16px 0; padding: 12px 16px; border-radius: 8px; background-color: #020617; text-align: left;">
      <p style="margin: 0 0 6px; color: #e5e7eb; font-weight: 600;">Reported product details</p>
      ${
        values.productName
          ? `<p style="margin: 0 0 4px; color: #d1d5db;">Name: ${values.productName}</p>`
          : ''
      }
      ${
        values.productId
          ? `<p style="margin: 0 0 4px; color: #9ca3af;">ID: ${values.productId}</p>`
          : ''
      }
      ${
        values.productDetails
          ? `<p style="margin: 0; color: #9ca3af;">${values.productDetails}</p>`
          : ''
      }
    </div>
    `
        : ''
    }
    <p style="margin: 16px 0 0; color: #6b7280;">
      If you have any questions about this decision, you can contact our support team from your dashboard.
    </p>
  `;

  const data = {
    to: values.email,
    subject: `${projectName} report status update`,
    html: baseTemplate('Report status update', bodyContent),
  };

  return data;
};

export type IIssueCreatedEmail = {
  email: string;
  productName: string;
  issueType: string;
  reason: string;
  refunded: boolean;
};

export type IIssueResolvedEmail = {
  email: string;
  productName: string;
  action: 'delete' | 'make_available';
};

const issueCreated = (values: IIssueCreatedEmail) => {
  const projectName = getProjectName();
  const productName = escapeHtml(values.productName);
  const reason = escapeHtml(values.reason);

  const issueTypeLabel =
    values.issueType === 'buyer_refused'
      ? 'Buyer Refused to Collect'
      : 'Verification Failed';

  const bodyContent = `
    <p style="margin: 0 0 10px; color: #d1d5db;">
      An issue has been reported for your product "${productName}".
    </p>
    <p style="margin: 8px 0; color: #d1d5db;">
      Issue Type: <strong style="color: #f9fafb;">${issueTypeLabel}</strong>
    </p>
    <p style="margin: 8px 0; color: #d1d5db;">
      Reason: <span style="color: #9ca3af;">${reason}</span>
    </p>
    ${values.refunded ? `
      <p style="margin: 8px 0; color: #d1d5db;">
        The buyer has been fully refunded.
      </p>
    ` : ''}
    <p style="margin: 16px 0 0; color: #6b7280;">
      Our admin team will take final action on this product shortly.
    </p>
  `;

  return {
    to: values.email,
    subject: `${projectName} - Issue Reported for Your Product`,
    html: baseTemplate('Issue Reported', bodyContent),
  };
};

const issueResolved = (values: IIssueResolvedEmail) => {
  const projectName = getProjectName();

  const bodyContent =
    values.action === 'delete'
      ? `
          <p style="margin: 0 0 10px; color: #d1d5db;">
            Your product "${values.productName}" has been permanently deleted from ${projectName}.
          </p>
          <p style="margin: 16px 0 0; color: #6b7280;">
            If you have questions, please contact our support team.
          </p>
        `
      : `
          <p style="margin: 0 0 10px; color: #d1d5db;">
            Great news! Your product "${values.productName}" has been marked as available again on ${projectName}.
          </p>
          <p style="margin: 16px 0 0; color: #6b7280;">
            It can now be purchased by other buyers.
          </p>
        `;

  const subject =
    values.action === 'delete'
      ? `${projectName} - Product Deleted`
      : `${projectName} - Product Back Online`;

  return {
    to: values.email,
    subject,
    html: baseTemplate(subject, bodyContent),
  };
};

export const emailTemplate = {
  createAccount,
  resetPassword,
  loginOtp,
  reportStatusUpdate,
  issueCreated,
  issueResolved,
};
