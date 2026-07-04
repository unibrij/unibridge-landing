// partner-portal/js/portalStorage.js

const ORGANIZATION_ID_STORAGE_KEY =
  "unibridge_partner_portal_organization_id";

function normalizeString(value) {
  return String(value || "").trim();
}

export function readStoredOrganizationId() {
  return localStorage.getItem(
    ORGANIZATION_ID_STORAGE_KEY
  ) || "";
}

export function storeOrganizationId(organizationId) {
  const normalizedOrganizationId =
    normalizeString(organizationId);

  if (!normalizedOrganizationId) {
    return;
  }

  localStorage.setItem(
    ORGANIZATION_ID_STORAGE_KEY,
    normalizedOrganizationId
  );
}

export function clearStoredOrganizationId() {
  localStorage.removeItem(
    ORGANIZATION_ID_STORAGE_KEY
  );
}

export default {
  readStoredOrganizationId,
  storeOrganizationId,
  clearStoredOrganizationId
};
