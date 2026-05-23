// connect-app/src/routes.js

export const ROUTES = [
  {
    id: "br_pix",
    label: "Brazil PIX route",
    country: "BR",
    rail: "PIX",
    network: "polygon",
    assets: ["USDT", "USDC"],

    beneficiaryFields: [
      {
        name: "pix_key",
        label: "PIX key",
        type: "text",
        placeholder: "email, CPF, phone, or random key",
        required: true
      }
    ]
  }
];

export function getRouteById(routeId) {
  return ROUTES.find(route => route.id === routeId) || ROUTES[0];
}

export function getInitialBeneficiary(route) {
  return route.beneficiaryFields.reduce((acc, field) => {
    acc[field.name] = "";
    return acc;
  }, {});
}
