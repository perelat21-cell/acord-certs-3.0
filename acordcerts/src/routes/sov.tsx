import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "../components/AppShell";
import SOVManager from "../components/SOVManager";
import type { SOVDocument } from "../lib/sov/types";
import { parseSOV } from "../lib/sov.functions";
import { generateCertificate } from "../lib/cert.functions";
import { uploadFile, safeName } from "../lib/upload";

export const Route = createFileRoute("/sov")({
  component: SOVPage,
});

function SOVPage() {
  function buildLocationRequest(
  location: SOVDocument["locations"][number],
) {
  return `Generate a certificate for this specific SOV location only.

SOV LOCATION:
Location Number: ${location.locationNumber ?? "Not provided"}
Address: ${location.address ?? "Not provided"}
City: ${location.city ?? "Not provided"}
State: ${location.state ?? "Not provided"}
ZIP: ${location.zip ?? "Not provided"}

PROPERTY INFORMATION FROM THE SOV:
Building Value: ${
    location.buildingValue !== undefined
      ? `$${location.buildingValue.toLocaleString()}`
      : "Not provided"
  }
Contents / BPP Value: ${
    location.contentsValue !== undefined
      ? `$${location.contentsValue.toLocaleString()}`
      : "Not provided"
  }
Business Income Value: ${
    location.businessIncomeValue !== undefined
      ? `$${location.businessIncomeValue.toLocaleString()}`
      : "Not provided"
  }
Rental Income Value: ${
    location.rentalIncomeValue !== undefined
      ? `$${location.rentalIncomeValue.toLocaleString()}`
      : "Not provided"
  }
Extra Expense Value: ${
    location.extraExpenseValue !== undefined
      ? `$${location.extraExpenseValue.toLocaleString()}`
      : "Not provided"
  }
Total Insured Value: ${
    location.totalInsuredValue !== undefined
      ? `$${location.totalInsuredValue.toLocaleString()}`
      : "Not provided"
  }

Other SOV Information:
Construction: ${location.construction ?? "Not provided"}
Occupancy: ${location.occupancy ?? "Not provided"}
Year Built: ${location.yearBuilt ?? "Not provided"}
Square Footage: ${location.squareFootage ?? "Not provided"}
Stories: ${location.stories ?? "Not provided"}
Sprinkler: ${location.sprinkler ?? "Not provided"}
Protection Class: ${location.protectionClass ?? "Not provided"}

INSTRUCTIONS:
- Generate the certificate for THIS SOV LOCATION ONLY.
- Use the attached policy/binder as the authoritative source for insurance information.
- Use the SOV information above for this property's location-specific information.
- Do not use property values or addresses from another SOV location.
- Do not invent insurance information.
- If the policy does not support a requested item, follow the normal certificate rules and report it as missing or unfulfilled.
- The SOV is not a substitute for the policy. It provides location-specific property information only.
`;
}
const [sov, setSov] = useState<SOVDocument>();
const [isUploading, setIsUploading] = useState(false);
const [policyFile, setPolicyFile] = useState<File>();
const [policyPath, setPolicyPath] = useState<string>();
const [isGenerating, setIsGenerating] = useState(false);

  async function handleUpload(file: File) {
    try {
      setIsUploading(true);

      toast.loading("Reading your SOV...", {
        id: "sov-upload",
      });

      const job = crypto.randomUUID();
      const path = `sov/${job}-${safeName(file.name)}`;

      await uploadFile(path, file);

      toast.loading("Analyzing locations and values...", {
        id: "sov-upload",
      });

      const result = await parseSOV({
        data: {
          path,
          fileName: file.name,
        },
      });

      const locations = result.locations;

      const totals = locations.reduce(
        (total, location) => {
          total.building += location.buildingValue ?? 0;
          total.contents += location.contentsValue ?? 0;
          total.businessIncome += location.businessIncomeValue ?? 0;
          total.rentalIncome += location.rentalIncomeValue ?? 0;
          total.extraExpense += location.extraExpenseValue ?? 0;

          total.totalInsuredValue +=
            location.totalInsuredValue ??
            (location.buildingValue ?? 0) +
              (location.contentsValue ?? 0) +
              (location.businessIncomeValue ?? 0) +
              (location.rentalIncomeValue ?? 0) +
              (location.extraExpenseValue ?? 0);

          return total;
        },
        {
          building: 0,
          contents: 0,
          businessIncome: 0,
          rentalIncome: 0,
          extraExpense: 0,
          totalInsuredValue: 0,
        },
      );

      const document: SOVDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        locations,
        totals,
        isActive: true,
      };

      setSov(document);

      toast.success(
        `SOV loaded — ${locations.length} location${
          locations.length === 1 ? "" : "s"
        } found.`,
        {
          id: "sov-upload",
        },
      );
    } catch (error) {
      console.error("SOV upload failed:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to read the SOV.",
        {
          id: "sov-upload",
        },
      );
    } finally {
      setIsUploading(false);
    }
  }
    async function handleGenerateAll() {
    if (!sov) {
      toast.error("Please upload an SOV first.");
      return;
    }

    if (!policyFile || !policyPath) {
      toast.error("Please upload a policy or binder first.");
      return;
    }

    try {
      setIsGenerating(true);

      toast.loading(
        `Generating certificates for ${sov.locations.length} locations...`,
        {
          id: "bulk-generation",
        },
      );

      let completed = 0;
      let failed = 0;

      for (const location of sov.locations) {
        try {
          await generateCertificate({
            data: {
              requestText: buildLocationRequest(location),
              files: [
                {
                  path: policyPath,
                  name: policyFile.name,
                  mime:
                    policyFile.type ||
                    "application/pdf",
                  role: "insurance",
                },
              ],
              savedIds: [],
              workflow: "certificate",
              preferredForm: "auto",
              edits: [],
            },
          });

          completed += 1;

          toast.loading(
            `Generating certificates... ${completed}/${sov.locations.length}`,
            {
              id: "bulk-generation",
            },
          );
        } catch (error) {
          failed += 1;

          console.error(
            `Certificate generation failed for location ${location.locationNumber ?? location.id}:`,
            error,
          );
        }
      }

      if (failed === 0) {
        toast.success(
          `All ${completed} certificates were generated successfully.`,
          {
            id: "bulk-generation",
          },
        );
      } else {
        toast.warning(
          `${completed} certificate${
            completed === 1 ? "" : "s"
          } generated. ${failed} failed.`,
          {
            id: "bulk-generation",
          },
        );
      }
    } catch (error) {
      console.error("Bulk certificate generation failed:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to generate certificates.",
        {
          id: "bulk-generation",
        },
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <AppShell>
      <div className={isUploading ? "pointer-events-none opacity-70" : ""}>
<SOVManager
  {...(sov ? { sov } : {})}
  policyFile={policyFile}
  onGenerateAll={handleGenerateAll}
  isGenerating={isGenerating}
onPolicyUpload={async (file) => {
  if (file.size === 0 && file.name === "") {
    setPolicyFile(undefined);
    setPolicyPath(undefined);
    return;
  }

  try {
    setIsUploading(true);

    toast.loading("Uploading policy...", {
      id: "policy-upload",
    });

    const path = `jobs/${crypto.randomUUID()}-${safeName(file.name)}`;

    await uploadFile(path, file);

    setPolicyFile(file);
    setPolicyPath(path);

    toast.success("Policy ready for certificate generation.", {
      id: "policy-upload",
    });
  } catch (error) {
    console.error("Policy upload failed:", error);

    toast.error(
      error instanceof Error
        ? error.message
        : "Unable to upload the policy.",
      {
        id: "policy-upload",
      },
    );
  } finally {
    setIsUploading(false);
  }
}}
  onUpload={handleUpload}
  onUpdateLocation={(locationId, updates) => {
            setSov((current) => {
              if (!current) {
                return current;
              }

              return {
                ...current,
                locations: current.locations.map((location) =>
                  location.id === locationId
                    ? {
                        ...location,
                        ...updates,
                        userCorrected: true,
                      }
                    : location,
                ),
              };
            });
          }}
        />
      </div>
    </AppShell>
  );
}