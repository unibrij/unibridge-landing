// shared/pricing/pricing-renderer.js

function isDomContainer(value) {
  return Boolean(
    value &&
    typeof value.appendChild ===
      "function" &&
    typeof value.replaceChildren ===
      "function"
  );
}

function createElement(
  tagName,
  className = null,
  textContent = null
) {
  const element =
    document.createElement(
      tagName
    );

  if (className) {
    element.className =
      className;
  }

  if (
    textContent !== null &&
    textContent !== undefined
  ) {
    element.textContent =
      String(textContent);
  }

  return element;
}

function createRetryIcon() {
  const namespace =
    "http://www.w3.org/2000/svg";

  const svg =
    document.createElementNS(
      namespace,
      "svg"
    );

  svg.setAttribute(
    "viewBox",
    "0 0 24 24"
  );

  svg.setAttribute(
    "aria-hidden",
    "true"
  );

  svg.setAttribute(
    "focusable",
    "false"
  );

  const path =
    document.createElementNS(
      namespace,
      "path"
    );

  path.setAttribute(
    "d",
    "M20 11a8 8 0 1 0 2 5.3M20 4v7h-7"
  );

  svg.appendChild(
    path
  );

  return svg;
}

function normalizeText(value) {
  return String(
    value ??
    ""
  ).trim();
}

function renderMeta(
  container,
  meta
) {
  const sourceLabel =
    normalizeText(
      meta?.sourceLabel
    );

  const destinationLabel =
    normalizeText(
      meta?.destinationLabel
    );

  if (
    !sourceLabel &&
    !destinationLabel
  ) {
    return;
  }

  const metaElement =
    createElement(
      "div",
      "pricing-meta"
    );

  if (sourceLabel) {
    metaElement.appendChild(
      createElement(
        "span",
        "pricing-meta-source",
        sourceLabel
      )
    );
  }

  if (
    sourceLabel &&
    destinationLabel
  ) {
    metaElement.appendChild(
      createElement(
        "span",
        "pricing-meta-separator",
        "→"
      )
    );
  }

  if (destinationLabel) {
    metaElement.appendChild(
      createElement(
        "span",
        "pricing-meta-destination",
        destinationLabel
      )
    );
  }

  container.appendChild(
    metaElement
  );
}

function createRowElement(row) {
  if (!row) {
    return null;
  }

  const label =
    normalizeText(
      row.label
    );

  const value =
    normalizeText(
      row.value
    );

  if (!value) {
    return null;
  }

  const emphasis =
    normalizeText(
      row.emphasis
    );

  const classNames = [
    "pricing-row"
  ];

  if (emphasis) {
    classNames.push(
      `pricing-row-${emphasis}`
    );
  }

  const rowElement =
    createElement(
      "div",
      classNames.join(" ")
    );

  if (row.key) {
    rowElement.dataset.pricingRow =
      String(row.key);
  }

  rowElement.appendChild(
    createElement(
      "span",
      "pricing-row-label",
      label
    )
  );

  rowElement.appendChild(
    createElement(
      "span",
      "pricing-row-value",
      value
    )
  );

  return rowElement;
}

function renderRows(
  container,
  rows,
  className
) {
  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return false;
  }

  const rowsElement =
    createElement(
      "div",
      className
    );

  for (const row of rows) {
    const rowElement =
      createRowElement(
        row
      );

    if (rowElement) {
      rowsElement.appendChild(
        rowElement
      );
    }
  }

  if (
    !rowsElement
      .childElementCount
  ) {
    return false;
  }

  container.appendChild(
    rowsElement
  );

  return true;
}

function renderSummaryRows(
  container,
  summaryRows
) {
  return renderRows(
    container,
    summaryRows,
    "pricing-summary-rows"
  );
}

function renderDetails(
  container,
  details
) {
  const rows =
    details?.rows;

  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return;
  }

  const detailsElement =
    createElement(
      "details",
      "pricing-details"
    );

  const label =
    normalizeText(
      details.label
    );

  if (label) {
    detailsElement.appendChild(
      createElement(
        "summary",
        "pricing-details-summary",
        label
      )
    );
  }

  const hasRows =
    renderRows(
      detailsElement,
      rows,
      "pricing-details-rows"
    );

  if (!hasRows) {
    return;
  }

  container.appendChild(
    detailsElement
  );
}

function renderNote(
  container,
  note
) {
  const value =
    normalizeText(
      note?.value
    );

  if (!value) {
    return;
  }

  container.appendChild(
    createElement(
      "div",
      "pricing-note",
      value
    )
  );
}

export function renderPricing(
  container,
  viewModel
) {
  if (!isDomContainer(container)) {
    throw new TypeError(
      "Pricing container must be a DOM element."
    );
  }

  container.replaceChildren();

  if (!viewModel) {
    container.hidden = true;
    return;
  }

  const card =
    createElement(
      "section",
      "pricing-card"
    );

  renderMeta(
    card,
    viewModel.meta
  );

  renderSummaryRows(
    card,
    viewModel.summaryRows
  );

  renderDetails(
    card,
    viewModel.details
  );

  renderNote(
    card,
    viewModel.note
  );

  if (!card.childElementCount) {
    container.hidden = true;
    return;
  }

  container.appendChild(
    card
  );

  container.hidden = false;
}

export function renderPricingError(
  container,
  {
    title =
      "Live pricing is temporarily unavailable.",

    message =
      "Please try again in a moment.",

    retryLabel =
      "Try again",

    onRetry =
      null
  } = {}
) {
  if (!isDomContainer(container)) {
    throw new TypeError(
      "Pricing container must be a DOM element."
    );
  }

  container.replaceChildren();

  const normalizedTitle =
    normalizeText(
      title
    );

  const normalizedMessage =
    normalizeText(
      message
    );

  const normalizedRetryLabel =
    normalizeText(
      retryLabel
    );

  const card =
    createElement(
      "section",
      "pricing-error-card"
    );

  card.setAttribute(
    "role",
    "status"
  );

  card.setAttribute(
    "aria-live",
    "polite"
  );

  card.setAttribute(
    "aria-atomic",
    "true"
  );

  const content =
    createElement(
      "div",
      "pricing-error-content"
    );

  const icon =
    createElement(
      "span",
      "pricing-error-icon",
      "!"
    );

  icon.setAttribute(
    "aria-hidden",
    "true"
  );

  const copy =
    createElement(
      "div",
      "pricing-error-copy"
    );

  if (normalizedTitle) {
    copy.appendChild(
      createElement(
        "strong",
        "pricing-error-title",
        normalizedTitle
      )
    );
  }

  if (normalizedMessage) {
    copy.appendChild(
      createElement(
        "p",
        "pricing-error-message",
        normalizedMessage
      )
    );
  }

  if (copy.childElementCount) {
    content.appendChild(
      icon
    );

    content.appendChild(
      copy
    );

    card.appendChild(
      content
    );
  }

  if (
    typeof onRetry ===
      "function" &&
    normalizedRetryLabel
  ) {
    const retryButton =
      createElement(
        "button",
        "pricing-error-retry"
      );

    retryButton.type =
      "button";

    retryButton.appendChild(
      createRetryIcon()
    );

    retryButton.appendChild(
      createElement(
        "span",
        null,
        normalizedRetryLabel
      )
    );

    retryButton.addEventListener(
      "click",
      onRetry
    );

    card.appendChild(
      retryButton
    );
  }

  if (!card.childElementCount) {
    container.hidden = true;
    return;
  }

  container.appendChild(
    card
  );

  container.hidden = false;
}

export function clearPricing(
  container
) {
  if (!isDomContainer(container)) {
    return;
  }

  container.replaceChildren();
  container.hidden = true;
}
