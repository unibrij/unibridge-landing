// fiat/bank-transfer/js/providerDestinationRegistry.js

import {
  collectCoinsPhProviderDestination,
  isCoinsPhProviderRoute,
  renderCoinsPhProviderDestination,
  resetCoinsPhProviderDestination
} from "./providers/coinsphProviderDestination.js";

const providerDestinations = [
  {
    id:
      "coinsph",

    matches:
      isCoinsPhProviderRoute,

    render:
      renderCoinsPhProviderDestination,

    collect:
      collectCoinsPhProviderDestination,

    reset:
      resetCoinsPhProviderDestination
  }
];

export function resolveProviderDestination(route = {}) {
  return providerDestinations.find((provider) => {
    return (
      typeof provider.matches === "function" &&
      provider.matches(route)
    );
  }) || null;
}

export function hasProviderDestination(route = {}) {
  return Boolean(
    resolveProviderDestination(route)
  );
}

export function renderProviderDestination({
  container,
  route,
  onChange
} = {}) {
  const provider =
    resolveProviderDestination(route);

  if (!provider) {
    resetProviderDestinations();

    return false;
  }

  resetProviderDestinations({
    except:
      provider.id
  });

  return provider.render({
    container,
    route,
    onChange
  });
}

export function collectProviderDestination(route = {}) {
  const provider =
    resolveProviderDestination(route);

  if (!provider) {
    return null;
  }

  return provider.collect(route);
}

export function resetProviderDestinations({
  except
} = {}) {
  providerDestinations.forEach((provider) => {
    if (
      except &&
      provider.id === except
    ) {
      return;
    }

    if (typeof provider.reset === "function") {
      provider.reset();
    }
  });
}
