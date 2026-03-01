const { Resend } = require('resend');

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

// For Resend free tier, we must use their default sender
const DEFAULT_FROM = 'TiendaBea <onboarding@resend.dev>';

async function sendEmail(to, subject, html) {
  if (!resend) {
    console.error('Resend not configured');
    return { success: false, error: 'Resend not configured' };
  }
  
  try {
    const data = await resend.emails.send({
      from: DEFAULT_FROM,
      to: to,
      subject: subject,
      html: html
    });
    
    console.log('Email sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Error sending email:', error.message);
    return { success: false, error: error.message };
  }
}

async function sendVerificationEmail(email, token) {
  const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; text-align: center;">TiendaBea</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">¡Bienvenido a TiendaBea!</h2>
        <p style="color: #666; line-height: 1.6;">
          Para completar tu registro y acceder a tu cuenta, 
          necesitas verificar tu correo electrónico.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Verificar mi correo
          </a>
        </div>
        <p style="color: #999; font-size: 12px; text-align: center;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
          ${verificationUrl}
        </p>
        <p style="color: #999; font-size: 12px;">
          Este enlace expira en 24 horas.
        </p>
      </div>
      <div style="text-align: center; padding: 20px; color: #999; font-size: 11px;">
        <p>© ${new Date().getFullYear()} TiendaBea. Todos los derechos reservados.</p>
      </div>
    </div>
  `;
  
  return sendEmail(email, 'Verifica tu correo electrónico - TiendaBea', html);
}

async function sendAdminVerificationEmail(email, token) {
  const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; text-align: center;">TiendaBea</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">¡Bienvenido!</h2>
        <p style="color: #666; line-height: 1.6;">
          Has sido creado como administrador de TiendaBea. Para acceder al panel de administración, 
          necesitas verificar tu correo electrónico.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Verificar mi cuenta
          </a>
        </div>
        <p style="color: #999; font-size: 12px; text-align: center;">
          Si el botón no funciona: ${verificationUrl}
        </p>
        <p style="color: #999; font-size: 12px;">
          Este enlace expira en 24 horas.
        </p>
      </div>
    </div>
  `;
  
  return sendEmail(email, 'Verifica tu cuenta de administrador - TiendaBea', html);
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendAdminVerificationEmail
};
