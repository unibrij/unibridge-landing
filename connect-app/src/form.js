// connect-app/src/form.js

export function validateRouteForm({
  form,
  route
}) {
  const amount =
    Number(form.amount);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error("amount_required");
  }

  for (const field of route.beneficiaryFields) {
    const value =
      String(
        form.beneficiary?.[field.name] || ""
      ).trim();

    if (field.required && !value) {
      throw new Error(`${field.name}_required`);
    }
  }

  return true;
}
