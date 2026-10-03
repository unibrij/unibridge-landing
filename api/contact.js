import nodemailer from "nodemailer";

const SUPPORT_EMAIL =
  "support@unibrij.io";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const {
      name = "",
      email = "",
      company = "",
      reference = "",
      subject = "",
      message = "",
      website = "",
      "cf-turnstile-response": turnstileToken = ""
    } = req.body || {};

    const cleanName =
      String(name).trim();

    const cleanEmail =
      String(email).trim();

    const cleanCompany =
      String(company).trim();

    const cleanReference =
      String(reference).trim();

    const cleanSubject =
      String(subject).trim();

    const cleanMessage =
      String(message).trim();

    const cleanWebsite =
      String(website).trim();


    /*
    --------------------------------------------------
    Honeypot
    --------------------------------------------------
    */

    if (cleanWebsite) {
      return res.status(400).json({
        success: false,
        message: "Spam detected."
      });
    }


    /*
    --------------------------------------------------
    Required fields
    --------------------------------------------------
    */

    if (
      !cleanName ||
      !cleanEmail ||
      !cleanMessage
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields."
      });
    }


    /*
    --------------------------------------------------
    Email validation
    --------------------------------------------------
    */

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailRegex.test(
        cleanEmail
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address."
      });
    }


    /*
    --------------------------------------------------
    Turnstile
    --------------------------------------------------
    */

    if (!turnstileToken) {
      return res.status(400).json({
        success: false,
        message: "Security verification is required."
      });
    }

    const turnstileSecret =
      process.env
        .TURNSTILE_SECRET_KEY;

    if (!turnstileSecret) {
      console.error(
        "Missing TURNSTILE_SECRET_KEY"
      );

      return res.status(500).json({
        success: false,
        message: "Server misconfiguration."
      });
    }


    /*
    --------------------------------------------------
    Mail configuration
    --------------------------------------------------
    */

    if (
      !process.env.MAIL_USER ||
      !process.env.MAIL_PASS ||
      !process.env.TO_EMAIL
    ) {
      console.error(
        "Missing mail environment variables"
      );

      return res.status(500).json({
        success: false,
        message: "Server misconfiguration."
      });
    }


    /*
    --------------------------------------------------
    Client IP
    --------------------------------------------------
    */

    const ip =
      req.headers[
        "x-forwarded-for"
      ]
        ?.toString()
        .split(",")[0]
        .trim() ||
      req.socket
        ?.remoteAddress ||
      "";


    /*
    --------------------------------------------------
    Verify Turnstile
    --------------------------------------------------
    */

    const formBody =
      new URLSearchParams();

    formBody.append(
      "secret",
      turnstileSecret
    );

    formBody.append(
      "response",
      turnstileToken
    );

    if (ip) {
      formBody.append(
        "remoteip",
        ip
      );
    }

    const turnstileRes =
      await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded"
          },

          body:
            formBody.toString()
        }
      );

    const turnstileData =
      await turnstileRes.json();

    if (
      !turnstileData.success
    ) {
      console.error(
        "Turnstile verification failed:",
        turnstileData
      );

      return res.status(400).json({
        success: false,
        message: "Security verification failed."
      });
    }


    /*
    --------------------------------------------------
    Mail transport

    Authentication stays on the real mailbox:
    ceo@unibrij.io

    support@unibrij.io is used only as the
    verified Send mail as address.
    --------------------------------------------------
    */

    const transporter =
      nodemailer.createTransport({
        host:
          "smtp.gmail.com",

        port:
          465,

        secure:
          true,

        auth: {
          user:
            process.env.MAIL_USER,

          pass:
            process.env.MAIL_PASS
        }
      });

    await transporter.verify();


    /*
    --------------------------------------------------
    Internal notification
    --------------------------------------------------
    */

    await transporter.sendMail({
      from:
        `"UniBridge Contact" <${SUPPORT_EMAIL}>`,

      to:
        process.env.TO_EMAIL,

      replyTo:
        cleanEmail,

      subject:
        `New UniBridge Contact Request${
          cleanCompany
            ? ` – ${cleanCompany}`
            : ""
        }`,

      text: `
Full name: ${cleanName}
Email: ${cleanEmail}
Company / Project: ${cleanCompany || "—"}
Payout reference: ${cleanReference || "—"}
Subject: ${cleanSubject || "—"}

Message:
${cleanMessage}
      `.trim()
    });


    /*
    --------------------------------------------------
    Auto reply
    --------------------------------------------------
    */

    const autoReplyHTML = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; padding: 20px;">
        <img
          src="https://www.unibrij.io/public/icons/social/unibridge-orbit-lockup-dark.png"
          alt="UniBridge Logo"
          style="width: 160px; max-width: 100%; margin-bottom: 24px;"
        />

        <h2 style="margin: 0 0 10px; color: #003366;">
          Hi ${escapeHtml(cleanName)},
        </h2>

        <p>
          We’ve received your message.
        </p>

        <p style="margin-top: 15px; color: #333;">
          Our team will review it and follow up as needed.
        </p>

        <p style="margin-top: 25px;">
          Best regards,<br/>
          <strong>UniBridge Technologies</strong>
        </p>

        <hr style="margin: 30px 0; opacity: .2;" />

        <p style="font-size: 12px; color: #666;">
          This is an automated confirmation email.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from:
        `"UniBridge" <${SUPPORT_EMAIL}>`,

      to:
        cleanEmail,

      replyTo:
        SUPPORT_EMAIL,

      subject:
        "We received your request – UniBridge",

      html:
        autoReplyHTML
    });


    /*
    --------------------------------------------------
    Success
    --------------------------------------------------
    */

    return res.status(200).json({
      success: true
    });
  }
  catch (
    err
  ) {
    console.error(
      "Contact API error:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  }
}


function escapeHtml(
  value
) {
  return String(
    value
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}
