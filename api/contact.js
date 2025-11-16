import nodemailer from "nodemailer";

export default async function handler(req, res) {
  try {
    const { name, email, subject, message } = req.body;

    // SMTP settings (Google Workspace)
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"UniBridge Contact" <${process.env.MAIL_USER}>`,
      to: process.env.TO_EMAIL,
      subject: `New API Access Request - ${subject}`,
      text: `
Full name: ${name}
Email: ${email}
Company: ${subject}
Message: ${message}
      `,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: err.message });
  }
}
