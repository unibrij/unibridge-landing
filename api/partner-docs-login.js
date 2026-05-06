export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({
      ok: false,
      error: "method_not_allowed"
    });
    return;
  }

  const expectedPassword = process.env.PARTNER_DOCS_PASSWORD;

  if (!expectedPassword) {
    res.status(500).json({
      ok: false,
      error: "password_not_configured"
    });
    return;
  }

  const { password } = req.body || {};
  const submittedPassword =
    typeof password === "string" ? password.trim() : "";

  if (submittedPassword !== expectedPassword) {
    res.status(401).json({
      ok: false,
      error: "invalid_password"
    });
    return;
  }

  res.setHeader(
    "Set-Cookie",
    [
      "ub_partner_docs_access=granted",
      "Path=/partner-docs",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Max-Age=86400"
    ].join("; ")
  );

  res.status(200).json({
    ok: true
  });
}
