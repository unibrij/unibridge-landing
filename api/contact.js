import nodemailer from "nodemailer";

export default async function handler(req, res) {
  try {
    const { name, email, subject, message } = req.body;

    //
    // 1) Transporter (Google Workspace)
    //
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    //
    // 2) Email sent to UniBridge (internal notification)
    //
    await transporter.sendMail({
      from: `"UniBridge Contact" <${process.env.MAIL_USER}>`,
      to: process.env.TO_EMAIL,
      subject: `New API Access Request – ${subject}`,
      text: `
Full name: ${name}
Email: ${email}
Company: ${subject}
Message: ${message}
      `,
    });

    //
    // 3) Auto-Reply to the sender
    //
    const autoReplyHTML = `
  <div style="font-family:Arial, sans-serif; line-height:1.6; padding:20px;">
    <img src="https://www.unibrij.io/unibrij-logo.png" 
         alt="UniBridge Logo" 
         style="width:70px; margin-bottom:20px;" />

    <h2 style="margin:0 0 10px; color:#003366;">
      Hi ${name},
    </h2>

    <p>
      Thank you for contacting <strong>UniBridge</strong>.
      We received your request and our team will review it shortly.
    </p>

    <p style="margin-top:15px; color:#333;">
      Access to UniBridge is provided on an invite-only basis and
      initially focuses on documentation and architectural evaluation.
    </p>

    <p style="margin-top:10px; color:#333;">
      <strong>
        Technical integration environments may be provided separately upon mutual agreement.
      </strong>
    </p>

    <p style="margin-top:25px;">
      Best regards,<br/>
      <strong>UniBridge Technologies</strong><br/>
      Built on Stellar rails
    </p>

    <hr style="margin:30px 0; opacity:.2;" />

    <p style="font-size:12px; color:#666;">
      This is an automated confirmation email.
    </p>
  </div>
`;

    await transporter.sendMail({
      from: `"UniBridge" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "We received your request – UniBridge",
      html: autoReplyHTML,
    });

    //
    // Done
    //
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}
