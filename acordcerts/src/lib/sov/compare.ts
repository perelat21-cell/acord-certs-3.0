import type { SOVLocation } from "./types";

export type SOVComparisonStatus =
  | "match"
  | "mismatch"
  | "missing"
  | "review";

export type SOVComparisonItem = {
  field: string;
  label: string;
  sovValue?: string | number | undefined;
  policyValue?: string | number | undefined;
  difference?: number | undefined;
  status: SOVComparisonStatus;
};

export type SOVLocationComparison = {
  location: SOVLocation;
  policyLocation?: Record<string, unknown>;
  status: SOVComparisonStatus;
  items: SOVComparisonItem[];
};

const TOLERANCE_PERCENT = 0.001;
const TOLERANCE_DOLLARS = 1000;

function numbersMatch(
  a: number | undefined,
  b: number | undefined,
) {
  if (a === undefined || b === undefined) {
    return false;
  }

  const difference = Math.abs(a - b);

  const tolerance = Math.max(
    TOLERANCE_DOLLARS,
    Math.abs(a) * TOLERANCE_PERCENT,
  );

  return difference <= tolerance;
}

function compareNumber(
  field: string,
  label: string,
  sovValue?: number,
  policyValue?: number,
): SOVComparisonItem {
  if (sovValue === undefined || policyValue === undefined) {
    return {
      field,
      label,
      sovValue,
      policyValue,
      status: "missing",
    };
  }

  const difference = policyValue - sovValue;

  return {
    field,
    label,
    sovValue,
    policyValue,
    difference,
    status: numbersMatch(sovValue, policyValue)
      ? "match"
      : "mismatch",
  };
}

export function compareSOVLocation(
  sov: SOVLocation,
  policy?: Record<string, unknown>,
): SOVLocationComparison {
  if (!policy) {
    return {
      location: sov,
      status: "missing",
      items: [],
    };
  }

  const buildingValue =
    typeof policy["buildingValue"] === "number"
      ? policy["buildingValue"]
      : undefined;

  const contentsValue =
    typeof policy["contentsValue"] === "number"
      ? policy["contentsValue"]
      : undefined;

  const businessIncomeValue =
    typeof policy["businessIncomeValue"] === "number"
      ? policy["businessIncomeValue"]
      : undefined;

  const totalInsuredValue =
    typeof policy["totalInsuredValue"] === "number"
      ? policy["totalInsuredValue"]
      : undefined;

  const items: SOVComparisonItem[] = [];

  items.push(
    compareNumber(
      "buildingValue",
      "Building Value",
      sov.buildingValue,
      buildingValue,
    ),
  );

  items.push(
    compareNumber(
      "contentsValue",
      "Contents / BPP",
      sov.contentsValue,
      contentsValue,
    ),
  );

  items.push(
    compareNumber(
      "businessIncomeValue",
      "Business Income",
      sov.businessIncomeValue,
      businessIncomeValue,
    ),
  );

  items.push(
    compareNumber(
      "totalInsuredValue",
      "Total Insured Value",
      sov.totalInsuredValue,
      totalInsuredValue,
    ),
  );

  let status: SOVComparisonStatus = "match";

  if (items.some((item) => item.status === "mismatch")) {
    status = "mismatch";
  } else if (items.some((item) => item.status === "review")) {
    status = "review";
  } else if (items.some((item) => item.status === "missing")) {
    status = "missing";
  }

  return {
    location: sov,
    policyLocation: policy,
    status,
    items,
  };
}