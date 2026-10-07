export type SOVConfidence = "high" | "medium" | "low";

export type SOVLocation = {
  id: string;
  locationNumber?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  zip?: string | undefined;
  buildingValue?: number | undefined;
  contentsValue?: number | undefined;
  businessIncomeValue?: number | undefined;
  rentalIncomeValue?: number | undefined;
  extraExpenseValue?: number | undefined;
  totalInsuredValue?: number | undefined;
  construction?: string | undefined;
  occupancy?: string | undefined;
  yearBuilt?: number | undefined;
  squareFootage?: number | undefined;
  stories?: number | undefined;
  sprinkler?: string | undefined;
  protectionClass?: string | undefined;
  confidence?: SOVConfidence | undefined;
  userCorrected?: boolean | undefined;
  sourceReference?: {
    page?: number | undefined;
    sheet?: string | undefined;
    row?: number | undefined;
    cell?: string | undefined;
  } | undefined;
};

export type SOVTotals = {
  building?: number;
  contents?: number;
  businessIncome?: number;
  rentalIncome?: number;
  extraExpense?: number;
  totalInsuredValue?: number;
};

export type SOVDocument = {
  id: string;

  name: string;
  fileName: string;

  uploadedAt: string;

  locations: SOVLocation[];

  totals: SOVTotals;

  isActive: boolean;
};