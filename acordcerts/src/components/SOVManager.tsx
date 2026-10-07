import { useMemo, useState } from "react";
import {
  Upload,
  Search,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  FileText,
  X,
} from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

import type { SOVDocument, SOVLocation } from "../lib/sov/types";

type Props = {
  sov?: SOVDocument;
  onUpload?: (file: File) => void;
  onPolicyUpload?: (file: File) => void;
  policyFile?: File | undefined;
  onGenerateAll?: () => void;
  isGenerating?: boolean;
  onUpdateLocation?: (
    locationId: string,
    updates: Partial<SOVLocation>,
  ) => void;
};

function money(value?: number) {
  if (value === undefined || value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SOVManager({
  sov,
  onUpload,
  onPolicyUpload,
  policyFile,
  onGenerateAll,
  isGenerating,
  onUpdateLocation,
}: Props) {
  const [search, setSearch] = useState("");

  const locations = sov?.locations ?? [];

  const filteredLocations = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return locations;
    }

    return locations.filter((location) =>
      [
        location.locationNumber,
        location.address,
        location.city,
        location.state,
        location.zip,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [locations, search]);

  const totals = useMemo(() => {
    return locations.reduce(
      (result, location) => {
        result.building += location.buildingValue ?? 0;
        result.contents += location.contentsValue ?? 0;
        result.businessIncome +=
          location.businessIncomeValue ?? 0;
        result.tiv += location.totalInsuredValue ?? 0;

        return result;
      },
      {
        building: 0,
        contents: 0,
        businessIncome: 0,
        tiv: 0,
      },
    );
  }, [locations]);

  if (!sov) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed p-10 text-center transition hover:border-primary/50">
          <div className="mx-auto flex max-w-md flex-col items-center">
            <div className="mb-4 rounded-2xl bg-primary/10 p-4">
              <Upload className="h-7 w-7 text-primary" />
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Upload an Excel, CSV, or PDF SOV. The system will
              extract the locations and values for review.
            </p>

            <label className="mt-6 cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) {
                    onUpload?.(file);
                  }

                  event.target.value = "";
                }}
              />

              <span className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90">
                Choose SOV
              </span>
            </label>

            <p className="mt-3 text-xs text-muted-foreground">
              Excel (.xlsx, .xls), CSV, or PDF
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Statement of Values
            </h2>

            <Badge variant="secondary">
              {locations.length} locations
            </Badge>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {sov.fileName}
          </p>
        </div>

        <div>
          <Button
            variant="outline"
            onClick={() => {
              document
                .getElementById("sov-replace-input")
                ?.click();
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Replace SOV
          </Button>

          <input
            id="sov-replace-input"
            type="file"
            accept=".xlsx,.xls,.csv,.pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                onUpload?.(file);
              }

              event.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Policy / Binder */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />

              <h3 className="font-semibold">
                Policy / Binder
              </h3>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Upload the policy or binder that should be used
              to create the certificates for these locations.
            </p>
          </div>

          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  onPolicyUpload?.(file);
                }

                event.target.value = "";
              }}
            />

            <span className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-accent hover:text-accent-foreground">
              <Upload className="mr-2 h-4 w-4" />
              {policyFile ? "Replace Policy" : "Choose Policy"}
            </span>
          </label>
        </div>

        {policyFile && (
          <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />

              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {policyFile.name}
                </p>

                <p className="text-xs text-muted-foreground">
                  Ready for certificate generation
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onPolicyUpload?.(new File([], ""))}
              title="Remove policy"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>

      <Card className="border-primary/20 bg-primary/[0.03] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-semibold">
              Generate Certificates
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Create a certificate for every location in this SOV
              using the uploaded policy or binder.
            </p>
          </div>

          <Button
            onClick={onGenerateAll}
            disabled={!policyFile || locations.length === 0 || isGenerating}
            className="shrink-0"
          >
            {isGenerating
              ? "Generating..."
              : `Generate ${locations.length} Certificate${
                  locations.length === 1 ? "" : "s"
                }`}
          </Button>
        </div>

        {!policyFile && (
          <p className="mt-3 text-xs text-muted-foreground">
            Upload a policy or binder above to enable certificate
            generation.
          </p>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">
            Locations
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {locations.length}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-muted-foreground">
            Building
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {money(totals.building)}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-muted-foreground">
            Contents / BPP
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {money(totals.contents)}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-muted-foreground">
            Total Insured Value
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {money(totals.tiv)}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search locations..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium">
                  Location
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Address
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  Building
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  BPP
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  Business Income
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  TIV
                </th>

                <th className="px-4 py-3 text-center font-medium">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredLocations.map((location) => (
                <tr
                  key={location.id}
                  className="border-b last:border-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-4 font-medium">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {location.locationNumber ?? "—"}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div>
                      {location.address ?? "—"}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {[
                        location.city,
                        location.state,
                        location.zip,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  </td>

                  <td className="px-4 py-4 text-right">
                    {money(location.buildingValue)}
                  </td>

                  <td className="px-4 py-4 text-right">
                    {money(location.contentsValue)}
                  </td>

                  <td className="px-4 py-4 text-right">
                    {money(location.businessIncomeValue)}
                  </td>

                  <td className="px-4 py-4 text-right font-medium">
                    {money(location.totalInsuredValue)}
                  </td>

                  <td className="px-4 py-4 text-center">
                    {location.userCorrected ? (
                      <Badge variant="secondary">
                        Corrected
                      </Badge>
                    ) : location.confidence === "low" ? (
                      <Badge
                        variant="outline"
                        className="gap-1"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Review
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Ready
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}

              {filteredLocations.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No locations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}