import * as XLSX from "xlsx";

export type SOVSpreadsheet = {
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
};

export function readSOVExcel(
  bytes: Uint8Array,
  fileName: string,
): SOVSpreadsheet[] {
  const workbook = XLSX.read(bytes, {
    type: "array",
    cellDates: true,
  });

  return workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      return [];
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      sheet,
      {
        defval: null,
        raw: false,
      },
    );

    const headers = Array.from(
      new Set(rows.flatMap((row) => Object.keys(row))),
    );

    return [
      {
        sheetName,
        headers,
        rows,
      },
    ];
  });
}