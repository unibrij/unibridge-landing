export default function middleware(request: Request) {
  const password = process.env.PARTNER_DOCS_PASSWORD;

  if (!password) {
    return new Response("Partner docs password is not configured.", {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }

  const authHeader = request.headers.get("authorization");
  const expected = "Basic " + btoa("partner:" + password);

  if (authHeader === expected) {
    return;
  }

  return new Response("Authentication required", {
    status: 401,
    headers: {
      "www-authenticate": 'Basic realm="UniBridge Partner Docs"',
      "content-type": "text/plain; charset=utf-8"
    }
  });
}

export const config = {
  matcher: ["/partner-docs/:path*"]
};
