const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Create transporter
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    requireTLS: true,
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
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

// Send verification email
async function sendVerificationEmail(email, token) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
  
  const mailOptions = {
    from: process.env.FROM_EMAIL || 'TiendaBea <noreply@tiendabea.com>',
    to: email,
    subject: 'Verifica tu correo electrónico - TiendaBea',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">TiendaBea</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">¡Bienvenido a TiendaBea!</h2>
          <p style="color: #666; line-height: 1.6;">
            Gracias por registrarte. Para completar tu registro y acceder a tu cuenta, 
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
            Este enlace expire en 24 horas. Si no solicitaste este correo, puedes ignorarlo.
          </p>
        </div>
        <div style="text-align: center; padding: 20px; color: #999; font-size: 11px;">
          <p>© ${new Date().getFullYear()} TiendaBea. Todos los derechos reservados.</p>
        </div>
      </div>
    `
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to: ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error.message);
    return false;
  }
}

// Send welcome email (after verification)
async function sendWelcomeEmail(email, name) {
  const mailOptions = {
    from: process.env.FROM_EMAIL || 'TiendaBea <noreply@tiendabea.com>',
    to: email,
    subject: '¡Tu cuenta ha sido verificada! - TiendaBea',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">TiendaBea</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">¡Cuenta verificada!</h2>
          <p style="color: #666; line-height: 1.6;">
            Hola <strong>${name}</strong>,<br><br>
            Tu correo electrónico ha sido verificado exitosamente. 
            Ahora puedes acceder a tu cuenta y disfrutar de todos los servicios de TiendaBea.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.BASE_URL || 'http://localhost:3000'}/login" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Iniciar sesión
            </a>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; color: #999; font-size: 11px;">
          <p>© ${new Date().getFullYear()} TiendaBea. Todos los derechos reservados.</p>
        </div>
      </div>
    `
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to: ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error.message);
    return false;
  }
}

module.exports = {
  createTransporter,
  generateVerificationToken,
  hashToken,
  sendVerificationEmail,
  sendWelcomeEmail
};
