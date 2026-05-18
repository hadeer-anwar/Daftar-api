import { Injectable } from '@nestjs/common';

import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend = new Resend(process.env.RESEND_API_KEY);

  async sendResetCode(to: string, code: string) {
    try {
      const response = await this.resend.emails.send({
        from: 'Daftar <onboarding@resend.dev>',

        to,

        subject: 'Reset Password',

        html: `
            <h2>Daftar Password Reset</h2>

            <p>Your verification code:</p>

            <h1>${code}</h1>

            <p>
              This code expires in 10 minutes.
            </p>
          `,
      });

      return response;
    } catch (error) {
      console.error(error);

      throw error;
    }
  }
}
