import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  const fromEmail = connectionSettings.settings.from_email || 'noreply@send.cellionone.com';
  console.log(`[Email] Using from_email: ${fromEmail}`);
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail
  };
}

export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendVerificationEmail(to: string, token: string, baseUrl: string) {
  const { client, fromEmail } = await getResendClient();
  const verificationLink = `${baseUrl}/verify-email?token=${token}`;
  
  console.log(`[Email] Sending verification email to: ${to}, from: ${fromEmail}`);
  
  const result = await client.emails.send({
    from: fromEmail,
    to,
    subject: 'Verify your email - Celion One',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #16a34a; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <span style="color: white; font-size: 24px; font-weight: bold;">C</span>
              </div>
              <h1 style="color: #18181b; font-size: 24px; margin: 0;">Celion One</h1>
            </div>
            
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Verify your email address</h2>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Thank you for registering with Celion One. Please click the button below to verify your email address and complete your registration.
            </p>
            
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${verificationLink}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #71717a; font-size: 14px; line-height: 1.6;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="color: #16a34a; font-size: 14px; word-break: break-all; margin-bottom: 24px;">
              ${verificationLink}
            </p>
            
            <p style="color: #71717a; font-size: 14px; line-height: 1.6;">
              This link will expire in 24 hours. If you didn't create an account with Celion One, you can safely ignore this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
              &copy; ${new Date().getFullYear()} Cellion Platforms Nigeria Limited. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `
  });
  
  console.log(`[Email] Verification email result:`, JSON.stringify(result));
  return result;
}

export async function sendPasswordResetEmail(to: string, token: string, baseUrl: string) {
  const { client, fromEmail } = await getResendClient();
  const resetLink = `${baseUrl}/reset-password?token=${token}`;
  
  const result = await client.emails.send({
    from: fromEmail,
    to,
    subject: 'Reset your password - Celion One',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #16a34a; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <span style="color: white; font-size: 24px; font-weight: bold;">C</span>
              </div>
              <h1 style="color: #18181b; font-size: 24px; margin: 0;">Celion One</h1>
            </div>
            
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Reset your password</h2>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              We received a request to reset your password. Click the button below to create a new password.
            </p>
            
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${resetLink}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #71717a; font-size: 14px; line-height: 1.6;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="color: #16a34a; font-size: 14px; word-break: break-all; margin-bottom: 24px;">
              ${resetLink}
            </p>
            
            <p style="color: #71717a; font-size: 14px; line-height: 1.6;">
              This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
              &copy; ${new Date().getFullYear()} Cellion Platforms Nigeria Limited. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `
  });
  
  return result;
}

export async function sendWelcomeEmail(to: string, firstName: string) {
  const { client, fromEmail } = await getResendClient();
  
  const result = await client.emails.send({
    from: fromEmail,
    to,
    subject: 'Welcome to Celion One!',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #16a34a; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <span style="color: white; font-size: 24px; font-weight: bold;">C</span>
              </div>
              <h1 style="color: #18181b; font-size: 24px; margin: 0;">Celion One</h1>
            </div>
            
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Welcome, ${firstName}!</h2>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Thank you for joining Celion One - Nigeria's premier company incorporation platform. You're now ready to start your business journey.
            </p>
            
            <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <h3 style="color: #166534; font-size: 16px; margin: 0 0 12px 0;">What you can do next:</h3>
              <ul style="color: #15803d; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Complete your identity verification</li>
                <li>Start a new company registration application</li>
                <li>Upload required documents</li>
                <li>Track your application progress</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://cellionone.com" style="display: inline-block; background: #16a34a; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                Go to Dashboard
              </a>
            </div>
            
            <p style="color: #71717a; font-size: 14px; line-height: 1.6;">
              If you have any questions, our team is here to help. Contact us at service@cellionone.com.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
              &copy; ${new Date().getFullYear()} Cellion Platforms Nigeria Limited. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `
  });
  
  return result;
}

export async function sendApplicationStatusEmail(
  to: string, 
  firstName: string, 
  companyName: string, 
  status: string, 
  message?: string
) {
  const { client, fromEmail } = await getResendClient();
  
  const statusColors: Record<string, { bg: string; text: string }> = {
    submitted: { bg: '#dbeafe', text: '#1e40af' },
    under_review: { bg: '#fef3c7', text: '#92400e' },
    approved: { bg: '#d1fae5', text: '#065f46' },
    rejected: { bg: '#fee2e2', text: '#991b1b' },
    completed: { bg: '#d1fae5', text: '#065f46' },
  };
  
  const statusLabels: Record<string, string> = {
    submitted: 'Submitted',
    under_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
    completed: 'Completed',
  };
  
  const colors = statusColors[status] || { bg: '#e4e4e7', text: '#52525b' };
  const statusLabel = statusLabels[status] || status;
  
  const result = await client.emails.send({
    from: fromEmail,
    to,
    subject: `Application Update: ${companyName} - ${statusLabel}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #16a34a; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <span style="color: white; font-size: 24px; font-weight: bold;">C</span>
              </div>
              <h1 style="color: #18181b; font-size: 24px; margin: 0;">Celion One</h1>
            </div>
            
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Application Status Update</h2>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              Dear ${firstName},
            </p>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Your application for <strong>${companyName}</strong> has been updated.
            </p>
            
            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
              <p style="color: #71717a; font-size: 14px; margin: 0 0 8px 0;">Current Status</p>
              <span style="display: inline-block; background: ${colors.bg}; color: ${colors.text}; padding: 8px 16px; border-radius: 20px; font-weight: 500;">
                ${statusLabel}
              </span>
            </div>
            
            ${message ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px;">
              <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.6;">
                ${message}
              </p>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://cellionone.com" style="display: inline-block; background: #16a34a; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                View Application
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
              &copy; ${new Date().getFullYear()} Cellion Platforms Nigeria Limited. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `
  });
  
  return result;
}

export async function sendComplianceReminderEmail(
  to: string,
  firstName: string,
  companyName: string,
  deadlineTitle: string,
  dueDate: Date,
  daysRemaining: number,
  penaltyInfo: string
) {
  const { client, fromEmail } = await getResendClient();

  const isOverdue = daysRemaining < 0;
  const subject = isOverdue
    ? `[OVERDUE] ${deadlineTitle} OVERDUE by ${Math.abs(daysRemaining)} days - ${companyName}`
    : `[Action Required] ${deadlineTitle} due in ${daysRemaining} days - ${companyName}`;

  const formattedDate = dueDate.toLocaleDateString('en-NG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const urgencyColor = isOverdue ? '#dc2626' : daysRemaining <= 7 ? '#f59e0b' : '#16a34a';
  const urgencyBg = isOverdue ? '#fef2f2' : daysRemaining <= 7 ? '#fffbeb' : '#f0fdf4';
  const urgencyLabel = isOverdue ? 'OVERDUE' : daysRemaining <= 7 ? 'URGENT' : 'UPCOMING';

  const result = await client.emails.send({
    from: fromEmail,
    to,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #16a34a; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <span style="color: white; font-size: 24px; font-weight: bold;">C</span>
              </div>
              <h1 style="color: #18181b; font-size: 24px; margin: 0;">Celion One</h1>
            </div>
            
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Compliance Deadline Reminder</h2>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              Dear ${firstName},
            </p>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              This is a reminder about an ${isOverdue ? 'overdue' : 'upcoming'} compliance deadline for <strong>${companyName}</strong>.
            </p>
            
            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #71717a; font-size: 14px;">Deadline</span>
                <span style="display: inline-block; background: ${urgencyBg}; color: ${urgencyColor}; padding: 4px 12px; border-radius: 20px; font-weight: 500; font-size: 12px;">${urgencyLabel}</span>
              </div>
              <h3 style="color: #18181b; font-size: 18px; margin: 0 0 8px 0;">${deadlineTitle}</h3>
              <p style="color: #52525b; font-size: 14px; margin: 0 0 4px 0;">Due Date: <strong>${formattedDate}</strong></p>
              <p style="color: ${urgencyColor}; font-size: 14px; margin: 0; font-weight: 500;">
                ${isOverdue ? `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''}` : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`}
              </p>
            </div>
            
            ${penaltyInfo ? `
            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
              <p style="color: #991b1b; font-size: 14px; margin: 0 0 4px 0; font-weight: 600;">Penalty Warning</p>
              <p style="color: #991b1b; font-size: 14px; margin: 0; line-height: 1.6;">
                ${penaltyInfo}
              </p>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://cellionone.com" style="display: inline-block; background: #16a34a; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                View Compliance Calendar
              </a>
            </div>
            
            <p style="color: #71717a; font-size: 14px; line-height: 1.6;">
              Stay on top of your compliance obligations to avoid penalties. If you have any questions, contact us at service@cellionone.com.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
              &copy; ${new Date().getFullYear()} Cellion Platforms Nigeria Limited. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `
  });

  return result;
}

export async function sendChecklistNudgeEmail(
  to: string,
  firstName: string,
  companyName: string,
  incompleteTasks: { title: string; description: string }[],
  completedCount: number,
  totalCount: number
) {
  const { client, fromEmail } = await getResendClient();

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const taskListHtml = incompleteTasks.map(task => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e4e4e7;">
        <p style="color: #18181b; font-size: 14px; margin: 0 0 4px 0; font-weight: 500;">${task.title}</p>
        <p style="color: #71717a; font-size: 13px; margin: 0; line-height: 1.4;">${task.description}</p>
      </td>
    </tr>
  `).join('');

  const result = await client.emails.send({
    from: fromEmail,
    to,
    subject: `Your post-incorporation checklist: ${completedCount}/${totalCount} completed - ${companyName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #16a34a; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <span style="color: white; font-size: 24px; font-weight: bold;">C</span>
              </div>
              <h1 style="color: #18181b; font-size: 24px; margin: 0;">Celion One</h1>
            </div>
            
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Checklist Progress Update</h2>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              Dear ${firstName},
            </p>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Here's an update on your post-incorporation checklist for <strong>${companyName}</strong>. You're making progress - keep going!
            </p>
            
            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
              <p style="color: #71717a; font-size: 14px; margin: 0 0 12px 0;">Progress</p>
              <div style="background: #e4e4e7; border-radius: 10px; height: 20px; margin-bottom: 8px; overflow: hidden;">
                <div style="background: #16a34a; height: 100%; width: ${progressPercent}%; border-radius: 10px;"></div>
              </div>
              <p style="color: #18181b; font-size: 16px; margin: 0; font-weight: 600;">${completedCount} of ${totalCount} tasks completed (${progressPercent}%)</p>
            </div>
            
            ${incompleteTasks.length > 0 ? `
            <div style="margin-bottom: 24px;">
              <h3 style="color: #18181b; font-size: 16px; margin: 0 0 12px 0;">Remaining Tasks:</h3>
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #e4e4e7; border-radius: 8px;">
                ${taskListHtml}
              </table>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://cellionone.com" style="display: inline-block; background: #16a34a; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                Complete Your Checklist
              </a>
            </div>
            
            <p style="color: #71717a; font-size: 14px; line-height: 1.6;">
              Completing your checklist ensures your company is fully set up and compliant. If you need help, contact us at service@cellionone.com.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
              &copy; ${new Date().getFullYear()} Cellion Platforms Nigeria Limited. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `
  });

  return result;
}

export async function sendIncorporationCompleteEmail(
  to: string,
  firstName: string,
  companyName: string,
  companyType: string
) {
  const { client, fromEmail } = await getResendClient();

  const result = await client.emails.send({
    from: fromEmail,
    to,
    subject: `Congratulations! ${companyName} has been incorporated`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #16a34a; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <span style="color: white; font-size: 24px; font-weight: bold;">C</span>
              </div>
              <h1 style="color: #18181b; font-size: 24px; margin: 0;">Celion One</h1>
            </div>
            
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: #f0fdf4; border-radius: 50%; padding: 16px; margin-bottom: 16px;">
                <span style="font-size: 32px; color: #16a34a;">&#10003;</span>
              </div>
              <h2 style="color: #18181b; font-size: 24px; margin: 0 0 8px 0;">Congratulations, ${firstName}!</h2>
              <p style="color: #52525b; font-size: 16px; margin: 0;">Your company has been successfully incorporated.</p>
            </div>
            
            <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
              <p style="color: #71717a; font-size: 14px; margin: 0 0 4px 0;">Company Name</p>
              <h3 style="color: #166534; font-size: 20px; margin: 0 0 4px 0;">${companyName}</h3>
              <p style="color: #15803d; font-size: 14px; margin: 0;">Type: ${companyType}</p>
            </div>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Your company registration is now complete. Here's what to do next to get your business fully operational:
            </p>
            
            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <h3 style="color: #18181b; font-size: 16px; margin: 0 0 12px 0;">Next Steps:</h3>
              <ul style="color: #52525b; font-size: 14px; line-height: 2; margin: 0; padding-left: 20px;">
                <li>Set up your company profile with all relevant details</li>
                <li>Start your post-incorporation checklist</li>
                <li>Review your compliance calendar for upcoming deadlines</li>
                <li>Set up your registered office address</li>
                <li>Store important documents in your secure vault</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://cellionone.com" style="display: inline-block; background: #16a34a; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                View Your Company Profile
              </a>
            </div>
            
            <p style="color: #71717a; font-size: 14px; line-height: 1.6;">
              We're excited to be part of your business journey. If you have any questions, contact us at service@cellionone.com.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
              &copy; ${new Date().getFullYear()} Cellion Platforms Nigeria Limited. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `
  });

  return result;
}
