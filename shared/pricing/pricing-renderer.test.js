// @vitest-environment jsdom

// shared/pricing/pricing-renderer.test.js

import {
  beforeEach,
  describe,
  expect,
  it
} from "vitest";

import {
  clearPricing,
  renderPricing
} from "./pricing-renderer.js";

function createContainer() {
  const container =
    document.createElement(
      "div"
    );

  document.body.appendChild(
    container
  );

  return container;
}

function createViewModel(
  overrides = {}
) {
  return {
    header: {
      title:
        "Quote ready",

      subtitle:
        "Review the estimated transaction details."
    },

    rows: [
      {
        key:
          "recipient_amount",

        label:
          "Recipient receives",

        value:
          "125 BRL",

        primary: true
      },

      {
        key:
          "customer_payment",

        label:
          "You pay",

        value:
          "25 USDC",

        primary: false
      }
    ],

    status: {
      value:
        "Rate locked"
    },

    meta: {
      sourceLabel:
        "USDC on Polygon",

      destinationLabel:
        "Brazil PIX"
    },

    ...overrides
  };
}

describe(
  "pricing-renderer",
  () => {
    beforeEach(
      () => {
        document.body.replaceChildren();
      }
    );

    describe(
      "renderPricing",
      () => {
        it(
          "throws when the container is invalid",
          () => {
            expect(
              () =>
                renderPricing(
                  null,
                  createViewModel()
                )
            ).toThrow(
              new TypeError(
                "Pricing container must be a DOM element."
              )
            );

            expect(
              () =>
                renderPricing(
                  {},
                  createViewModel()
                )
            ).toThrow(
              new TypeError(
                "Pricing container must be a DOM element."
              )
            );
          }
        );

        it(
          "accepts a DOM-compatible container without relying on instanceof Element",
          () => {
            const children = [];

            const container = {
              hidden: false,

              appendChild(
                child
              ) {
                children.push(child);
                return child;
              },

              replaceChildren() {
                children.length = 0;
              }
            };

            renderPricing(
              container,
              null
            );

            expect(
              container.hidden
            ).toBe(true);

            expect(children).toEqual([]);
          }
        );

        it(
          "clears and hides the container when the view model is missing",
          () => {
            const container =
              createContainer();

            container.hidden = false;
            container.textContent =
              "Previous content";

            renderPricing(
              container,
              null
            );

            expect(
              container.childElementCount
            ).toBe(0);

            expect(
              container.textContent
            ).toBe("");

            expect(
              container.hidden
            ).toBe(true);
          }
        );

        it(
          "renders the pricing card",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel()
            );

            const card =
              container.querySelector(
                ".pricing-card"
              );

            expect(card).not.toBeNull();

            expect(
              card.tagName
            ).toBe("SECTION");

            expect(
              container.hidden
            ).toBe(false);
          }
        );

        it(
          "renders the header title and subtitle",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel()
            );

            expect(
              container.querySelector(
                ".pricing-title"
              )?.textContent
            ).toBe(
              "Quote ready"
            );

            expect(
              container.querySelector(
                ".pricing-subtitle"
              )?.textContent
            ).toBe(
              "Review the estimated transaction details."
            );
          }
        );

        it(
          "omits the header when title and subtitle are empty",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel({
                header: {
                  title:
                    "   ",

                  subtitle:
                    null
                }
              })
            );

            expect(
              container.querySelector(
                ".pricing-header"
              )
            ).toBeNull();
          }
        );

        it(
          "renders only the available header fields",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel({
                header: {
                  title:
                    "Pricing",

                  subtitle:
                    ""
                }
              })
            );

            expect(
              container.querySelector(
                ".pricing-title"
              )?.textContent
            ).toBe("Pricing");

            expect(
              container.querySelector(
                ".pricing-subtitle"
              )
            ).toBeNull();
          }
        );

        it(
          "renders source and destination metadata with a separator",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel()
            );

            expect(
              container.querySelector(
                ".pricing-meta-source"
              )?.textContent
            ).toBe(
              "USDC on Polygon"
            );

            expect(
              container.querySelector(
                ".pricing-meta-separator"
              )?.textContent
            ).toBe("→");

            expect(
              container.querySelector(
                ".pricing-meta-destination"
              )?.textContent
            ).toBe(
              "Brazil PIX"
            );
          }
        );

        it(
          "does not render a metadata separator when only one label exists",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel({
                meta: {
                  sourceLabel:
                    "Wallet",

                  destinationLabel:
                    null
                }
              })
            );

            expect(
              container.querySelector(
                ".pricing-meta-source"
              )?.textContent
            ).toBe("Wallet");

            expect(
              container.querySelector(
                ".pricing-meta-separator"
              )
            ).toBeNull();

            expect(
              container.querySelector(
                ".pricing-meta-destination"
              )
            ).toBeNull();
          }
        );

        it(
          "omits metadata when both labels are empty",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel({
                meta: {
                  sourceLabel:
                    " ",

                  destinationLabel:
                    null
                }
              })
            );

            expect(
              container.querySelector(
                ".pricing-meta"
              )
            ).toBeNull();
          }
        );

        it(
          "renders pricing rows",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel()
            );

            const rows =
              container.querySelectorAll(
                ".pricing-row"
              );

            expect(rows).toHaveLength(2);

            expect(
              rows[0]
                .querySelector(
                  ".pricing-row-label"
                )
                ?.textContent
            ).toBe(
              "Recipient receives"
            );

            expect(
              rows[0]
                .querySelector(
                  ".pricing-row-value"
                )
                ?.textContent
            ).toBe(
              "125 BRL"
            );
          }
        );

        it(
          "marks primary rows",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel()
            );

            const primaryRow =
              container.querySelector(
                '[data-pricing-row="recipient_amount"]'
              );

            expect(
              primaryRow?.classList.contains(
                "pricing-row-primary"
              )
            ).toBe(true);

            const regularRow =
              container.querySelector(
                '[data-pricing-row="customer_payment"]'
              );

            expect(
              regularRow?.classList.contains(
                "pricing-row-primary"
              )
            ).toBe(false);
          }
        );

        it(
          "adds the row key as a data attribute",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel()
            );

            expect(
              container.querySelector(
                '[data-pricing-row="recipient_amount"]'
              )
            ).not.toBeNull();

            expect(
              container.querySelector(
                '[data-pricing-row="customer_payment"]'
              )
            ).not.toBeNull();
          }
        );

        it(
          "renders a row without a data attribute when its key is missing",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel({
                rows: [
                  {
                    label:
                      "Fee",

                    value:
                      "1 USDC",

                    primary:
                      false
                  }
                ]
              })
            );

            const row =
              container.querySelector(
                ".pricing-row"
              );

            expect(row).not.toBeNull();

            expect(
              row?.hasAttribute(
                "data-pricing-row"
              )
            ).toBe(false);
          }
        );

        it(
          "ignores null rows and rows without values",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel({
                rows: [
                  null,

                  {
                    key:
                      "missing_value",

                    label:
                      "Missing",

                    value:
                      null
                  },

                  {
                    key:
                      "empty_value",

                    label:
                      "Empty",

                    value:
                      "   "
                  },

                  {
                    key:
                      "valid_value",

                    label:
                      "Valid",

                    value:
                      "10 USDC"
                  }
                ]
              })
            );

            const rows =
              container.querySelectorAll(
                ".pricing-row"
              );

            expect(rows).toHaveLength(1);

            expect(
              rows[0].dataset.pricingRow
            ).toBe(
              "valid_value"
            );
          }
        );

        it(
          "renders an empty label when a row has a valid value",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel({
                rows: [
                  {
                    key:
                      "amount",

                    label:
                      null,

                    value:
                      "10 USDC"
                  }
                ]
              })
            );

            expect(
              container.querySelector(
                ".pricing-row-label"
              )?.textContent
            ).toBe("");

            expect(
              container.querySelector(
                ".pricing-row-value"
              )?.textContent
            ).toBe(
              "10 USDC"
            );
          }
        );

        it(
          "omits the rows container when rows are missing",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel({
                rows:
                  null
              })
            );

            expect(
              container.querySelector(
                ".pricing-rows"
              )
            ).toBeNull();
          }
        );

        it(
          "omits the rows container when no valid rows remain",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel({
                rows: [
                  null,

                  {
                    value:
                      ""
                  }
                ]
              })
            );

            expect(
              container.querySelector(
                ".pricing-rows"
              )
            ).toBeNull();
          }
        );

        it(
          "renders the status",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel()
            );

            expect(
              container.querySelector(
                ".pricing-status"
              )?.textContent
            ).toBe(
              "Rate locked"
            );
          }
        );

        it(
          "omits the status when its value is empty",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel({
                status: {
                  value:
                    "   "
                }
              })
            );

            expect(
              container.querySelector(
                ".pricing-status"
              )
            ).toBeNull();
          }
        );

        it(
          "hides the container when the view model has no renderable content",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              {
                header:
                  null,

                rows: [],

                status:
                  null,

                meta:
                  null
              }
            );

            expect(
              container.childElementCount
            ).toBe(0);

            expect(
              container.hidden
            ).toBe(true);
          }
        );

        it(
          "replaces previously rendered content",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel()
            );

            renderPricing(
              container,
              createViewModel({
                header: {
                  title:
                    "Updated quote",

                  subtitle:
                    null
                },

                rows: [],

                status:
                  null,

                meta:
                  null
              })
            );

            expect(
              container.querySelectorAll(
                ".pricing-card"
              )
            ).toHaveLength(1);

            expect(
              container.querySelector(
                ".pricing-title"
              )?.textContent
            ).toBe(
              "Updated quote"
            );

            expect(
              container.textContent
            ).not.toContain(
              "Recipient receives"
            );
          }
        );

        it(
          "renders untrusted content as text instead of HTML",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel({
                header: {
                  title:
                    "<img src=x onerror=alert(1)>",

                  subtitle:
                    "<script>alert(1)</script>"
                },

                rows: [
                  {
                    key:
                      "unsafe",

                    label:
                      "<strong>Label</strong>",

                    value:
                      "<button>Value</button>"
                  }
                ],

                status: {
                  value:
                    "<iframe></iframe>"
                },

                meta: {
                  sourceLabel:
                    "<em>Source</em>",

                  destinationLabel:
                    "<em>Destination</em>"
                }
              })
            );

            expect(
              container.querySelector(
                "img"
              )
            ).toBeNull();

            expect(
              container.querySelector(
                "script"
              )
            ).toBeNull();

            expect(
              container.querySelector(
                "strong"
              )
            ).toBeNull();

            expect(
              container.querySelector(
                "button"
              )
            ).toBeNull();

            expect(
              container.querySelector(
                "iframe"
              )
            ).toBeNull();

            expect(
              container.querySelector(
                ".pricing-title"
              )?.textContent
            ).toBe(
              "<img src=x onerror=alert(1)>"
            );

            expect(
              container.querySelector(
                ".pricing-row-value"
              )?.textContent
            ).toBe(
              "<button>Value</button>"
            );
          }
        );
      }
    );

    describe(
      "clearPricing",
      () => {
        it(
          "clears and hides a valid container",
          () => {
            const container =
              createContainer();

            renderPricing(
              container,
              createViewModel()
            );

            clearPricing(container);

            expect(
              container.childElementCount
            ).toBe(0);

            expect(
              container.hidden
            ).toBe(true);
          }
        );

        it(
          "does not throw for an invalid container",
          () => {
            expect(
              () =>
                clearPricing(null)
            ).not.toThrow();

            expect(
              () =>
                clearPricing({})
            ).not.toThrow();
          }
        );
      }
    );
  }
);
