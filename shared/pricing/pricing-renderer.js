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
    document.createElement(tagName);

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

function renderHeader(
  container,
  header
) {
  if (!header) {
    return;
  }

  const title =
    String(
      header.title ??
      ""
    ).trim();

  const subtitle =
    String(
      header.subtitle ??
      ""
    ).trim();

  if (
    !title &&
    !subtitle
  ) {
    return;
  }

  const headerElement =
    createElement(
      "div",
      "pricing-header"
    );

  if (title) {
    headerElement.appendChild(
      createElement(
        "h3",
        "pricing-title",
        title
      )
    );
  }

  if (subtitle) {
    headerElement.appendChild(
      createElement(
        "p",
        "pricing-subtitle",
        subtitle
      )
    );
  }

  container.appendChild(
    headerElement
  );
}

function renderMeta(
  container,
  meta
) {
  const sourceLabel =
    String(
      meta?.sourceLabel ??
      ""
    ).trim();

  const destinationLabel =
    String(
      meta?.destinationLabel ??
      ""
    ).trim();

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

function renderRows(
  container,
  rows
) {
  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return;
  }

  const rowsElement =
    createElement(
      "div",
      "pricing-rows"
    );

  for (const row of rows) {
    if (!row) {
      continue;
    }

    const label =
      String(
        row.label ??
        ""
      ).trim();

    const value =
      String(
        row.value ??
        ""
      ).trim();

    if (!value) {
      continue;
    }

    const rowElement =
      createElement(
        "div",
        [
          "pricing-row",
          row.primary
            ? "pricing-row-primary"
            : ""
        ]
          .filter(Boolean)
          .join(" ")
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

    rowsElement.appendChild(
      rowElement
    );
  }

  if (rowsElement.childElementCount) {
    container.appendChild(
      rowsElement
    );
  }
}

function renderStatus(
  container,
  status
) {
  const value =
    String(
      status?.value ??
      ""
    ).trim();

  if (!value) {
    return;
  }

  container.appendChild(
    createElement(
      "div",
      "pricing-status",
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

  renderHeader(
    card,
    viewModel.header
  );

  renderMeta(
    card,
    viewModel.meta
  );

  renderRows(
    card,
    viewModel.rows
  );

  renderStatus(
    card,
    viewModel.status
  );

  if (!card.childElementCount) {
    container.hidden = true;
    return;
  }

  container.appendChild(card);
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
