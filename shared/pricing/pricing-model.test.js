// shared/pricing/pricing-model.test.js

import {
  describe,
  expect,
  it
} from "vitest";

import {
  createPricingViewModel
} from "./pricing-model.js";

function findRow(
  viewModel,
  key
) {
  return viewModel.rows.find(
    row =>
      row.key === key
  );
}

describe(
  "createPricingViewModel",
  () => {
    it(
      "returns the default empty view model",
      () => {
        const result =
          createPricingViewModel();

        expect(result).toEqual({
          header: {
            title:
              "Quote ready",

            subtitle:
              "Review the estimated transaction details."
          },

          rows: [],

          status: null,

          meta: {
            sourceLabel: null,
            destinationLabel: null
          }
        });
      }
    );

    it(
      "builds the recipient amount as the primary row",
      () => {
        const result =
          createPricingViewModel({
            route: {
              payout_amount:
                "125.50",

              recipient_currency:
                "brl",

              recipient_amount_type:
                "final"
            }
          });

        expect(
          findRow(
            result,
            "recipient_amount"
          )
        ).toEqual({
          key:
            "recipient_amount",

          label:
            "Recipient receives",

          value:
            "125.5 BRL",

          primary: true
        });

        expect(result.status).toEqual({
          value:
            "Final amount"
        });
      }
    );

    it(
      "marks indicative recipient amounts as approximate",
      () => {
        const result =
          createPricingViewModel({
            route: {
              payout_amount:
                "250",

              recipient_currency:
                "php",

              recipient_amount_type:
                "indicative"
            }
          });

        expect(
          findRow(
            result,
            "recipient_amount"
          )
        ).toMatchObject({
          value:
            "≈ 250 PHP",

          primary: true
        });

        expect(result.status).toEqual({
          value:
            "Estimated — confirmed after funding"
        });
      }
    );

    it(
      "hides the recipient amount when it is unavailable",
      () => {
        const result =
          createPricingViewModel({
            route: {
              payout_amount:
                "250",

              recipient_currency:
                "PHP",

              recipient_amount_type:
                "unavailable"
            }
          });

        expect(
          findRow(
            result,
            "recipient_amount"
          )
        ).toBeUndefined();

        expect(result.status).toEqual({
          value:
            "Available after funding"
        });
      }
    );

    it(
      "treats confirmed_after_funding as unavailable",
      () => {
        const result =
          createPricingViewModel({
            route: {
              payout_amount:
                "250",

              recipient_currency:
                "PHP",

              payout_amount_status:
                "confirmed_after_funding"
            }
          });

        expect(
          findRow(
            result,
            "recipient_amount"
          )
        ).toBeUndefined();

        expect(result.status).toEqual({
          value:
            "Available after funding"
        });
      }
    );

    it(
      "uses an explicit customer payment amount",
      () => {
        const result =
          createPricingViewModel({
            customerPaymentAmount:
              "100",

            customerPaymentCurrency:
              "usdc"
          });

        expect(
          findRow(
            result,
            "customer_payment"
          )
        ).toEqual({
          key:
            "customer_payment",

          label:
            "You pay",

          value:
            "100 USDC",

          primary: false
        });
      }
    );

    it(
      "does not derive customer payment from route funding_amount",
      () => {
        const result =
          createPricingViewModel({
            route: {
              funding_amount:
                "100",

              settlement_currency:
                "USDC"
            }
          });

        expect(
          findRow(
            result,
            "customer_payment"
          )
        ).toBeUndefined();

        expect(
          findRow(
            result,
            "settlement_amount"
          )
        ).toMatchObject({
          value:
            "100 USDC"
        });
      }
    );

    it(
      "does not derive customer payment from canonical requested amount without funding semantics",
      () => {
        const result =
          createPricingViewModel({
            quote: {
              requested_amount:
                "100"
            },

            route: {
              pricing_result: {
                quote: {
                  requested: {
                    amount:
                      "100",

                    currency:
                      "USDC",

                    semantics:
                      "recipient_amount"
                  }
                }
              }
            }
          });

        expect(
          findRow(
            result,
            "customer_payment"
          )
        ).toBeUndefined();
      }
    );

    it(
      "derives customer payment from quote requested_amount when semantics are funding_amount",
      () => {
        const result =
          createPricingViewModel({
            quote: {
              requested_amount:
                "100"
            },

            route: {
              pricing_result: {
                quote: {
                  requested: {
                    amount:
                      "999",

                    currency:
                      "usdc",

                    semantics:
                      "funding_amount"
                  }
                }
              }
            }
          });

        expect(
          findRow(
            result,
            "customer_payment"
          )
        ).toEqual({
          key:
            "customer_payment",

          label:
            "You pay",

          value:
            "100 USDC",

          primary: false
        });
      }
    );

    it(
      "uses route amount_semantics for funding amount compatibility",
      () => {
        const result =
          createPricingViewModel({
            quote: {
              requested_amount:
                "75"
            },

            customerPaymentCurrency:
              "usdt",

            route: {
              amount_semantics:
                "funding_amount"
            }
          });

        expect(
          findRow(
            result,
            "customer_payment"
          )
        ).toMatchObject({
          value:
            "75 USDT"
        });
      }
    );

    it(
      "does not use canonical requested.amount as the customer payment value",
      () => {
        const result =
          createPricingViewModel({
            quote: {
              requested_amount:
                null
            },

            route: {
              pricing_result: {
                quote: {
                  requested: {
                    amount:
                      "500",

                    currency:
                      "USDC",

                    semantics:
                      "funding_amount"
                  }
                }
              }
            }
          });

        expect(
          findRow(
            result,
            "customer_payment"
          )
        ).toBeUndefined();
      }
    );

    it(
      "prefers canonical settlement and recipient values over legacy route values",
      () => {
        const result =
          createPricingViewModel({
            route: {
              funding_amount:
                "90",

              settlement_currency:
                "USDT",

              payout_amount:
                "400",

              recipient_currency:
                "PHP",

              pricing_result: {
                quote: {
                  settlement: {
                    amount:
                      "100",

                    currency:
                      "usdc"
                  },

                  recipient: {
                    amount:
                      "500",

                    currency:
                      "brl",

                    type:
                      "locked"
                  }
                }
              }
            }
          });

        expect(
          findRow(
            result,
            "settlement_amount"
          )
        ).toMatchObject({
          value:
            "100 USDC"
        });

        expect(
          findRow(
            result,
            "recipient_amount"
          )
        ).toMatchObject({
          value:
            "500 BRL"
        });

        expect(result.status).toEqual({
          value:
            "Rate locked"
        });
      }
    );

    it(
      "falls back to route pricing.quote",
      () => {
        const result =
          createPricingViewModel({
            route: {
              pricing: {
                quote: {
                  settlement: {
                    amount:
                      "10",

                    currency:
                      "USDC"
                  },

                  recipient: {
                    amount:
                      "55",

                    currency:
                      "BRL",

                    type:
                      "final"
                  }
                }
              }
            }
          });

        expect(
          findRow(
            result,
            "settlement_amount"
          )
        ).toMatchObject({
          value:
            "10 USDC"
        });

        expect(
          findRow(
            result,
            "recipient_amount"
          )
        ).toMatchObject({
          value:
            "55 BRL"
        });
      }
    );

    it(
      "renders the canonical exchange rate",
      () => {
        const result =
          createPricingViewModel({
            route: {
              pricing_result: {
                quote: {
                  settlement: {
                    amount:
                      "10",

                    currency:
                      "USDC"
                  },

                  recipient: {
                    amount:
                      "55",

                    currency:
                      "BRL"
                  },

                  fx_rate:
                    "5.5"
                }
              }
            }
          });

        expect(
          findRow(
            result,
            "fx_rate"
          )
        ).toMatchObject({
          label:
            "Exchange rate",

          value:
            "1 USDC = 5.5 BRL"
        });
      }
    );

    it(
      "falls back to the legacy exchange rate",
      () => {
        const result =
          createPricingViewModel({
            route: {
              settlement_currency:
                "USDT",

              recipient_currency:
                "PHP",

              fx_rate:
                "58.25"
            }
          });

        expect(
          findRow(
            result,
            "fx_rate"
          )
        ).toMatchObject({
          value:
            "1 USDT = 58.25 PHP"
        });
      }
    );

    it(
      "renders provider, UniBridge and partner fees separately",
      () => {
        const result =
          createPricingViewModel({
            route: {
              pricing_result: {
                quote: {
                  fees: [
                    {
                      type:
                        "provider",

                      amount:
                        "10",

                      currency:
                        "PHP"
                    },
                    {
                      type:
                        "unibridge",

                      amount:
                        "1.5",

                      currency:
                        "USDC"
                    },
                    {
                      type:
                        "partner",

                      amount:
                        "2",

                      currency:
                        "USDC"
                    }
                  ]
                }
              }
            }
          });

        expect(
          findRow(
            result,
            "provider_fee_php"
          )
        ).toMatchObject({
          label:
            "Provider fee",

          value:
            "10 PHP"
        });

        expect(
          findRow(
            result,
            "unibridge_fee_usdc"
          )
        ).toMatchObject({
          label:
            "UniBridge fee",

          value:
            "1.5 USDC"
        });

        expect(
          findRow(
            result,
            "partner_fee_usdc"
          )
        ).toMatchObject({
          label:
            "Partner fee",

          value:
            "2 USDC"
        });
      }
    );

    it(
      "does not use legacy fee fields when canonical fees exist as an empty array",
      () => {
        const result =
          createPricingViewModel({
            route: {
              recipient_currency:
                "PHP",

              settlement_currency:
                "USDC",

              executor_fee:
                "10",

              executor_fee_currency:
                "PHP",

              unibridge_fee:
                "1",

              unibridge_fee_currency:
                "USDC",

              partner_fee:
                "2",

              partner_fee_currency:
                "USDC",

              pricing_result: {
                quote: {
                  fees: []
                }
              }
            }
          });

        expect(
          result.rows.some(
            row =>
              row.key.startsWith(
                "provider_fee_"
              )
          )
        ).toBe(false);

        expect(
          result.rows.some(
            row =>
              row.key.startsWith(
                "unibridge_fee_"
              )
          )
        ).toBe(false);

        expect(
          result.rows.some(
            row =>
              row.key.startsWith(
                "partner_fee_"
              )
          )
        ).toBe(false);
      }
    );

    it(
      "uses legacy fee fields when canonical fees do not exist",
      () => {
        const result =
          createPricingViewModel({
            route: {
              recipient_currency:
                "PHP",

              settlement_currency:
                "USDC",

              executor_fee:
                "10",

              executor_fee_currency:
                "PHP",

              unibridge_fee:
                "1.25",

              unibridge_fee_currency:
                "USDC",

              partner_fee:
                "2",

              partner_fee_currency:
                "USDC"
            }
          });

        expect(
          findRow(
            result,
            "provider_fee_php"
          )
        ).toMatchObject({
          value:
            "10 PHP"
        });

        expect(
          findRow(
            result,
            "unibridge_fee_usdc"
          )
        ).toMatchObject({
          value:
            "1.25 USDC"
        });

        expect(
          findRow(
            result,
            "partner_fee_usdc"
          )
        ).toMatchObject({
          value:
            "2 USDC"
        });
      }
    );

    it(
      "creates separate fee rows for different currencies",
      () => {
        const result =
          createPricingViewModel({
            route: {
              pricing_result: {
                quote: {
                  fees: [
                    {
                      type:
                        "provider",

                      amount:
                        "5",

                      currency:
                        "PHP"
                    },
                    {
                      type:
                        "provider",

                      amount:
                        "1",

                      currency:
                        "USDC"
                    }
                  ]
                }
              }
            }
          });

        expect(
          findRow(
            result,
            "provider_fee_php"
          )
        ).toMatchObject({
          value:
            "5 PHP"
        });

        expect(
          findRow(
            result,
            "provider_fee_usdc"
          )
        ).toMatchObject({
          value:
            "1 USDC"
        });
      }
    );

    it(
      "uses explicit source and destination labels",
      () => {
        const result =
          createPricingViewModel({
            sourceLabel:
              "USDC on Polygon",

            destinationLabel:
              "Brazil PIX"
          });

        expect(result.meta).toEqual({
          sourceLabel:
            "USDC on Polygon",

          destinationLabel:
            "Brazil PIX"
        });
      }
    );

    it(
      "uses the route label as the destination fallback",
      () => {
        const result =
          createPricingViewModel({
            route: {
              label:
                "BR PIX"
            },

            sourceLabel:
              "Wallet"
          });

        expect(result.meta).toEqual({
          sourceLabel:
            "Wallet",

          destinationLabel:
            "BR PIX"
        });
      }
    );

    it(
      "allows supported labels to be overridden",
      () => {
        const result =
          createPricingViewModel({
            route: {
              payout_amount:
                "100",

              recipient_currency:
                "BRL",

              recipient_amount_type:
                "final"
            },

            labels: {
              title:
                "Pricing",

              subtitle:
                "Review details",

              recipientAmount:
                "Receives",

              finalStatus:
                "Confirmed"
            }
          });

        expect(result.header).toEqual({
          title:
            "Pricing",

          subtitle:
            "Review details"
        });

        expect(
          findRow(
            result,
            "recipient_amount"
          )
        ).toMatchObject({
          label:
            "Receives"
        });

        expect(result.status).toEqual({
          value:
            "Confirmed"
        });
      }
    );

    it(
      "ignores empty label overrides",
      () => {
        const result =
          createPricingViewModel({
            labels: {
              title:
                "   ",

              subtitle:
                null
            }
          });

        expect(result.header).toEqual({
          title:
            "Quote ready",

          subtitle:
            "Review the estimated transaction details."
        });
      }
    );

    it(
      "ignores invalid quote and route values",
      () => {
        const result =
          createPricingViewModel({
            quote:
              "invalid",

            route:
              123
          });

        expect(result.rows).toEqual([]);
        expect(result.status).toBeNull();
      }
    );

    it(
      "omits rows whose values cannot be formatted",
      () => {
        const result =
          createPricingViewModel({
            route: {
              payout_amount:
                "invalid",

              recipient_currency:
                "BRL",

              funding_amount:
                null,

              settlement_currency:
                "USDC",

              fx_rate:
                "invalid"
            }
          });

        expect(result.rows).toEqual([]);
      }
    );
  }
);
