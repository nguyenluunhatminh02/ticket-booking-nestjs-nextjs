import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly fromAddress: string;
  private readonly frontendUrl: string;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: configService.get('MAIL_HOST', 'localhost'),
      port: configService.get('MAIL_PORT', 1025),
      auth: configService.get('MAIL_USER')
        ? {
            user: configService.get('MAIL_USER'),
            pass: configService.get('MAIL_PASS'),
          }
        : undefined,
    });
    this.fromAddress = configService.get('MAIL_FROM', 'noreply@ticketbooking.com');
    this.frontendUrl = configService.get('APP_FRONTEND_URL', 'http://localhost:3000');
  }

  async sendVerificationEmail(to: string, firstName: string, token: string): Promise<void> {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${token}`;
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Verify Your Email Address',
        html: `
          <h2>Hello ${firstName},</h2>
          <p>Thank you for registering. Please verify your email address by clicking the link below:</p>
          <p><a href="${verifyUrl}">Verify Email</a></p>
          <p>This link will expire in 24 hours.</p>
          <p>If you did not create an account, please ignore this email.</p>
        `,
      });
      this.logger.log(`Verification email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${to}`, error.stack);
      throw error;
    }
  }

  async sendPasswordResetEmail(to: string, firstName: string, token: string): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Reset Your Password',
        html: `
          <h2>Hello ${firstName},</h2>
          <p>You requested a password reset. Click the link below to reset your password:</p>
          <p><a href="${resetUrl}">Reset Password</a></p>
          <p>This link will expire in 1 hour.</p>
          <p>If you did not request this, please ignore this email.</p>
        `,
      });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}`, error.stack);
      throw error;
    }
  }

  async sendPasswordChangedEmail(to: string, firstName: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Your Password Was Changed',
        html: `
          <h2>Hello ${firstName},</h2>
          <p>Your password has been successfully changed.</p>
          <p>If you did not make this change, please contact support immediately.</p>
        `,
      });
    } catch (error) {
      this.logger.error(`Failed to send password changed email to ${to}`, error.stack);
    }
  }

  async sendNewDeviceLoginEmail(
    to: string,
    firstName: string,
    deviceName: string,
    ipAddress: string,
    location: string,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'New Device Login Detected',
        html: `
          <h2>Hello ${firstName},</h2>
          <p>A new login was detected on your account:</p>
          <ul>
            <li>Device: ${deviceName}</li>
            <li>IP Address: ${ipAddress}</li>
            <li>Location: ${location || 'Unknown'}</li>
            <li>Time: ${new Date().toISOString()}</li>
          </ul>
          <p>If this wasn't you, please secure your account immediately.</p>
        `,
      });
    } catch (error) {
      this.logger.error(`Failed to send new device email to ${to}`, error.stack);
    }
  }

  async sendAccountLockedEmail(to: string, firstName: string, lockDurationMinutes: number): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Account Locked',
        html: `
          <h2>Hello ${firstName},</h2>
          <p>Your account has been locked due to multiple failed login attempts.</p>
          <p>It will be unlocked in ${lockDurationMinutes} minutes.</p>
          <p>If this wasn't you, please reset your password immediately.</p>
        `,
      });
    } catch (error) {
      this.logger.error(`Failed to send account locked email to ${to}`, error.stack);
    }
  }

  async sendPaymentSuccessEmail(to: string, firstName: string, paymentDetails: Record<string, any>): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Payment Successful',
        html: `
          <h2>Hello ${firstName},</h2>
          <p>Your payment of ${paymentDetails.amount} ${paymentDetails.currency} was successful!</p>
          <p>Event: ${paymentDetails.eventName}</p>
          <p>Tickets: ${paymentDetails.ticketCount}</p>
          <p>Thank you for your purchase!</p>
        `,
      });
    } catch (error) {
      this.logger.error(`Failed to send payment success email to ${to}`, error.stack);
    }
  }
}
