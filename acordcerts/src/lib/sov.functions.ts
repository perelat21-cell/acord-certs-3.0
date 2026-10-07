import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { readSOVExcel } from "./sov/excel";
import { downloadBytes } from "./cert.server";

const SOVLocationSchema = z.object({
  id: z.string(),
  locationNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  buildingValue: z.number().optional(),
  contentsValue: z.number().optional(),
  businessIncomeValue: z.number().optional(),
  rentalIncomeValue: z.number().optional(),
  extraExpenseValue: z.number().optional(),
  totalInsuredValue: z.number().optional(),
  construction: z.string().optional(),
  occupancy: z.string().optional(),
  yearBuilt: z.number().optional(),
  squareFootage: z.number().optional(),
  stories: z.number().optional(),
  sprinkler: z.string().optional(),
  protectionClass: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

const SOVResultSchema = z.object({
  locations: z.array(SOVLocationSchema),
});

export const parseSOV = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      path: z.string(),
      fileName: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const bytes = await downloadBytes(data.path);


    const fileName = data.fileName.toLowerCase();

    if (
      !fileName.endsWith(".xlsx") &&
      !fileName.endsWith(".xls") &&
      !fileName.endsWith(".csv")
    ) {
      throw new Error(
        "For now, SOV upload supports Excel (.xlsx/.xls) and CSV files.",
      );
    }
const sheets = readSOVExcel(bytes, data.fileName);

    if (!sheets.length) {
      throw new Error("No readable worksheets were found.");
    }

    const spreadsheetText = sheets
      .map((sheet) => {
        const rows = sheet.rows
          .slice(0, 500)
          .map((row) => JSON.stringify(row))
          .join("\n");

        return `SHEET: ${sheet.sheetName}

HEADERS:
${sheet.headers.join(" | ")}

ROWS:
${rows}`;
      })
      .join("\n\n====================\n\n");

    const apiKey = process.env["GEMINI_API_KEY"];

    if (!apiKey) {
      throw new Error("AI is not configured (missing GEMINI_API_KEY).");
    }

    const prompt = `You are an expert commercial property insurance Statement of Values (SOV) data specialist.

Convert the spreadsheet below into structured SOV location data.

IMPORTANT:
- Each physical property/location should become one location.
- Identify columns by meaning, NOT only by exact column names.
- Column names may vary considerably.
- Examples:
  - "Loc", "Location #", "Location Number" → locationNumber
  - "Address", "Property Address", "Street Address" → address
  - "Bldg", "Building Value", "Building Limit" → buildingValue
  - "BPP", "Contents", "Business Personal Property" → contentsValue
  - "BI", "Business Income", "Business Interruption" → businessIncomeValue
  - "TIV", "Total Insured Value", "Total Value" → totalInsuredValue
  - "Sq Ft", "Square Feet" → squareFootage
  - "Yr Built", "Year Built" → yearBuilt
  - "PC", "Protection Class" → protectionClass

VALUE RULES:
- Convert dollar amounts to numbers.
- Remove dollar signs and commas.
- Do not invent values.
- If a field is not present, leave it out.
- Do not combine separate locations.
- Preserve location numbers when available.
- Preserve addresses accurately.
- If a total insured value is explicitly provided, use it.
- If TIV is not provided but component values clearly add up to TIV, you may calculate it.
- Confidence should be:
  - "high" when the mapping is clear.
  - "medium" when the mapping is reasonably clear but not perfect.
  - "low" when the interpretation is uncertain.

Return ONLY JSON matching this structure:

{
  "locations": [
    {
      "id": "loc-1",
      "locationNumber": "1",
      "address": "123 Main Street",
      "city": "Brooklyn",
      "state": "NY",
      "zip": "11201",
      "buildingValue": 1000000,
      "contentsValue": 100000,
      "businessIncomeValue": 50000,
      "totalInsuredValue": 1150000,
      "confidence": "high"
    }
  ]
}

SPREADSHEET:

${spreadsheetText}`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      let detail = "";

      try {
        const body = (await response.json()) as {
          error?: { message?: string };
        };

        detail = body.error?.message ?? "";
      } catch {
        // Ignore malformed error responses.
      }

      throw new Error(
        `Gemini request failed (${response.status})${
          detail ? `: ${detail}` : ""
        }`,
      );
    }

    const body = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const rawText =
      body.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("") ?? "";

    if (!rawText.trim()) {
      throw new Error("Gemini returned an empty SOV response.");
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(
        rawText
          .replace(/^```json\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim(),
      );
    } catch {
      throw new Error("Gemini returned unreadable SOV data.");
    }

    return SOVResultSchema.parse(parsed);
  });