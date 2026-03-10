import type { Country } from "@/lib/constants";

export interface CountryMeta {
  code: Country;
  name: string;
  voltage: number;
}

const COUNTRY_DATA: Record<Country, CountryMeta> = {
  US: { code: "US", name: "United States", voltage: 120 },
  IE: { code: "IE", name: "Ireland", voltage: 230 },
  AU: { code: "AU", name: "Australia", voltage: 230 },
  CA: { code: "CA", name: "Canada", voltage: 120 },
  UK: { code: "UK", name: "United Kingdom", voltage: 230 },
  NZ: { code: "NZ", name: "New Zealand", voltage: 230 },
};

/** Currently supported countries for the route framework */
const SUPPORTED_COUNTRIES: Country[] = ["US", "IE", "AU"];

export function getCountryMeta(code: Country): CountryMeta {
  return COUNTRY_DATA[code];
}

export function getCountryName(code: Country): string {
  return COUNTRY_DATA[code].name;
}

export function getSupportedCountries(): CountryMeta[] {
  return SUPPORTED_COUNTRIES.map((c) => COUNTRY_DATA[c]);
}

export function hasVoltageChange(
  departure: Country,
  destinations: Country[]
): boolean {
  const departureVoltage = COUNTRY_DATA[departure].voltage;
  return destinations.some((d) => COUNTRY_DATA[d].voltage !== departureVoltage);
}
