import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly apiKey = process.env.BREVO_API_KEY;

  private readonly senderEmail = 'n16102502@gmail.com';

  private readonly senderName = 'Daftar';

  async sendResetCode(
    toEmail: string,
    otp: string,
    title = 'Password Reset Code',
  ) {
    if (!this.apiKey) {
      throw new Error('BREVO_API_KEY is not defined');
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify({
          sender: {
            email: this.senderEmail,
            name: this.senderName,
          },

          to: [
            {
              email: toEmail,
            },
          ],

          subject: title,

          htmlContent: `
              <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>${title}</h2>

                <p>Your OTP code is:</p>

                <div
                  style="
                    font-size: 32px;
                    font-weight: bold;
                    letter-spacing: 5px;
                    margin: 20px 0;
                  "
                >
                  ${otp}
                </div>

                <p>This code will expire in 10 minutes.</p>

                <p>If you did not request this, please ignore this email.</p>
              </div>
            `,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        console.error('Brevo Error:', errorText);

        throw new InternalServerErrorException('Failed to send email');
      }

      return (await response.json()) as unknown;
    } catch (error) {
      console.error('Mail Service Error:', error);

      throw new InternalServerErrorException('Failed to send email');
    }
  }
}
