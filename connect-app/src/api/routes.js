// connect-app/src/api/routes.js

import {
  API_BASE,
  assertOk,
  parseJson
} from "./client.js";


export async function getConnectRoutes() {
  const response =
    await fetch(
      `${API_BASE}/connect/routes`,
      {
        method:
          "GET",

        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );

  const data =
    await parseJson(
      response
    );

  assertOk(
    response,
    data,
    "get_connect_routes_failed"
  );

  return Array.isArray(
    data.routes
  )
    ? data.routes
    : [];
}
