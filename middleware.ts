export default function middleware(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  const isPartnerDocsIndex =
    pathname === "/partner-docs" ||
    pathname === "/partner-docs/" ||
    pathname === "/partner-docs/index.html";

  const isPartnerDocsAsset =
    pathname.startsWith("/partner-docs/assets/");

  if (isPartnerDocsIndex || isPartnerDocsAsset) {
    return;
  }

  const cookie = request.headers.get("cookie") || "";
  const hasAccess = cookie.includes("ub_partner_docs_access=granted");

  if (hasAccess) {
    return;
  }

  return Response.redirect(new URL("/partner-docs/", request.url), 302);
}

export const config = {
  matcher: ["/partner-docs/:path*"]
};
