// connect-app/src/flow/flowStorage.js

export const FLOW_STORAGE_KEY =
  "unibridge_connect_flow";

export function readStoredFlow() {
  try {
    return JSON.parse(
      localStorage.getItem(FLOW_STORAGE_KEY) || "null"
    );
  } catch {
    return null;
  }
}

export function storeFlowSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return;
  }

  localStorage.setItem(
    FLOW_STORAGE_KEY,
    JSON.stringify(snapshot)
  );
}

export function clearStoredFlow() {
  localStorage.removeItem(FLOW_STORAGE_KEY);
}
