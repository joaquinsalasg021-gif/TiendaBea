const nodemailer = require('nodemailer');
const crypto = require('crypto');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

// Create Nodemailer transporter with Gmail
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    requireTLS: true,
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    auth: {
      user: process.env.SMTP_USER || 'joaquinsalasg021@gmail.com',
      pass: process.env.SMTP_PASS
    }
  });
}

// Generate a secure random token
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Hash token for storage
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Send email using Nodemailer with Gmail
async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_PASS) {
    console.error('SMTP_PASS not configured - email will not be sent');
    console.log('To enable emails, set SMTP_PASS to your Gmail App Password');
    return { success: false, error: 'SMTP_PASS not configured' };
  }
  
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'TiendaBea <joaquinsalasg021@gmail.com>',
      to: to,
      subject: subject,
      html: html
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to: ${to}`);
    return { success: true };
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
  sendAdminVerificationEmail,
  generateVerificationToken,
  hashToken
};
