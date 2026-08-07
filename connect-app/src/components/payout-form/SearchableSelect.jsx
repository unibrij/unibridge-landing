// connect-app/src/components/payout-form/SearchableSelect.jsx

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  normalizeArray
} from "./routeUtils.js";

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export default function SearchableSelect({
  value,
  options,
  disabled,
  onChange,
  ariaLabel,
  placeholder = "Search bank or wallet"
}) {
  const [isOpen, setIsOpen] =
    useState(false);

  const [query, setQuery] =
    useState("");

  const shellRef =
    useRef(null);

  const safeOptions =
    normalizeArray(options);

  const selectedOption =
    safeOptions.find(
      option =>
        option.value === value
    ) ||
    null;

  const filteredOptions =
    useMemo(() => {
      const search =
        normalizeSearchText(
          query
        );

      if (!search) {
        return safeOptions.slice(
          0,
          40
        );
      }

      return safeOptions
        .filter(
          option =>
            normalizeSearchText(
              `${option.label} ${option.value}`
            ).includes(
              search
            )
        )
        .slice(
          0,
          40
        );
    }, [
      query,
      safeOptions
    ]);

  useEffect(() => {
    function handleClickOutside(
      event
    ) {
      if (!shellRef.current) {
        return;
      }

      if (
        !shellRef.current.contains(
          event.target
        )
      ) {
        setIsOpen(
          false
        );

        setQuery(
          ""
        );
      }
    }

    document.addEventListener(
      "click",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "click",
        handleClickOutside
      );
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      setIsOpen(
        false
      );

      setQuery(
        ""
      );
    }
  }, [
    disabled
  ]);

  return (
    <div
      ref={
        shellRef
      }
      className={
        isOpen
          ? "connect-select-shell is-open"
          : "connect-select-shell"
      }
    >
      <input
        type="text"
        className="connect-select-trigger"
        disabled={
          disabled
        }
        aria-label={
          ariaLabel
        }
        placeholder={
          selectedOption
            ?.label ||
          placeholder
        }
        value={
          isOpen
            ? query
            : selectedOption
                ?.label ||
              ""
        }
        onFocus={() => {
          if (disabled) {
            return;
          }

          setIsOpen(
            true
          );

          setQuery(
            ""
          );
        }}
        onClick={() => {
          if (disabled) {
            return;
          }

          setIsOpen(
            true
          );
        }}
        onChange={
          event => {
            setQuery(
              event.target.value
            );

            setIsOpen(
              true
            );
          }
        }
      />

      <div
        className="connect-select-menu"
        role="listbox"
      >
        {filteredOptions.length > 0 ? (
          filteredOptions.map(
            option => {
              const isSelected =
                option.value ===
                value;

              return (
                <button
                  key={
                    option.value
                  }
                  type="button"
                  className={
                    isSelected
                      ? "connect-select-option is-selected"
                      : "connect-select-option"
                  }
                  role="option"
                  aria-selected={
                    isSelected
                      ? "true"
                      : "false"
                  }
                  onClick={() => {
                    onChange(
                      option.value,
                      option
                    );

                    setQuery(
                      ""
                    );

                    setIsOpen(
                      false
                    );
                  }}
                >
                  {
                    option.label
                  }
                </button>
              );
            }
          )
        ) : (
          <div className="connect-select-option">
            No matching institution
          </div>
        )}
      </div>
    </div>
  );
}
