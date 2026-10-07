import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  Loader2,
  BookmarkPlus,
  RotateCcw,
  ShieldCheck,
  Building2,
  Files,
  Stamp,
  Wand2,
  User,
  Landmark,
  FileText,
  Home,
  Car,
  Umbrella,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PageTitle, Panel } from "@/components/AppShell";
import { DropZone } from "@/components/DropZone";
import { ReportView } from "@/components/ReportView";

import {
  generateCertificate,
  getCertificate,
  listSavedDocs,
  listTemplates,
  saveDocuments,
  updateCertificateFields,
  type CertReport,
} from "@/lib/cert.functions";

import { safeName, uploadFile } from "@/lib/upload";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { edit?: string } =>
    typeof s["edit"] === "string" ? { edit: s["edit"] } : {},

  head: () => ({
    meta: [
      { title: "New certificate — Certify" },
      {
        name: "description",
        content:
          "Upload a certificate request and policies to get a completed ACORD certificate.",
      },
      { property: "og:title", content: "New certificate — Certify" },
      {
        property: "og:description",
        content:
          "Upload a certificate request and policies to get a completed ACORD certificate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),

  component: NewCertificate,
});

type Uploaded = {
  path: string;
  name: string;
  mime: string;
  role: "request" | "insurance";
};

type Result = {
  id: string;
  url: string | null;
  sampleUrl: string | null;
  insured: string;
  holder: string;
  report: CertReport;
};

type Workflow = "certificate" | "application";

type ManualField = {
  name: string;
  value: string;
};

type ManualForm = {
  form_code: string;
  fields: ManualField[];
};

type CoveragePolicy = {
  name: string;
  fields: {
    field: ManualField;
    fieldIndex: number;
  }[];
};

function NewCertificate() {
  const [requestText, setRequestText] = useState("");
  const [requestFiles, setRequestFiles] = useState<File[]>([]);
  const [insFiles, setInsFiles] = useState<File[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [uploaded, setUploaded] = useState<Uploaded[]>([]);
  const [savedToLib, setSavedToLib] = useState(false);
  const [workflow, setWorkflow] = useState<Workflow>("certificate");
  const [preferredForm, setPreferredForm] = useState<
    "25" | "28" | "25,28" | "auto"
  >("25");

  const [showingSample, setShowingSample] = useState(false);
  const [editText, setEditText] = useState("");
  const [edits, setEdits] = useState<string[]>([]);

  const [manualForms, setManualForms] = useState<
    NonNullable<CertReport["forms"]>
  >([]);

  const [manualEditing, setManualEditing] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);

  const [openManualSections, setOpenManualSections] = useState<
    Record<string, boolean>
  >({});

  const [openCoveragePolicies, setOpenCoveragePolicies] = useState<
    Record<string, boolean>
  >({});

  const gen = useServerFn(generateCertificate);
  const fetchCert = useServerFn(getCertificate);
  const updateFields = useServerFn(updateCertificateFields);

  const { edit: editId } = Route.useSearch();

  useEffect(() => {
    if (!editId) return;

    setBusy("Opening certificate…");

    fetchCert({ data: { id: editId } })
      .then((r) => {
        setResult(r);
        setEdits(r.report.source?.edits ?? []);
        setUploaded(r.report.source?.files ?? []);
        setSavedToLib(true);

        if (!r.report.source) {
          toast.error(
            "This older certificate was made before editing was available, so it can't be changed.",
          );
        }
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setBusy(null));
  }, [editId]);

  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const urls = [result?.url, result?.sampleUrl].filter(
      (u): u is string => !!u && !blobUrls[u],
    );

    urls.forEach((u) => {
      fetch(u)
        .then((r) => r.blob())
        .then((b) => {
          const obj = URL.createObjectURL(
            new Blob([b], { type: "application/pdf" }),
          );

          setBlobUrls((m) => ({ ...m, [u]: obj }));
        })
        .catch(() => setBlobUrls((m) => ({ ...m, [u]: u })));
    });
  }, [result?.url, result?.sampleUrl]);

  const save = useServerFn(saveDocuments);

  const docs = useQuery({
    queryKey: ["saved"],
    queryFn: useServerFn(listSavedDocs),
  });

  const tpls = useQuery({
    queryKey: ["templates"],
    queryFn: useServerFn(listTemplates),
  });

  const canRun = insFiles.length || savedIds.length;

  async function run() {
    setResult(null);
    setShowingSample(false);
    setSavedToLib(false);
    setEdits([]);

    try {
      setBusy("Uploading documents…");

      const job = crypto.randomUUID();
      const up: Uploaded[] = [];

      for (const [role, list] of [
        ["request", requestFiles],
        ["insurance", insFiles],
      ] as const) {
        for (const f of list) {
          const path = await uploadFile(
            `jobs/${job}/${role}-${up.length}-${safeName(f.name)}`,
            f,
          );

          up.push({
            path,
            name: f.name,
            mime: f.type || "application/octet-stream",
            role,
          });
        }
      }

      setUploaded(up);

      setBusy(
        workflow === "application"
          ? "Reading documents and assembling the application…"
          : "Reading documents and filling the certificate…",
      );

      const r = await gen({
        data: {
          requestText,
          files: up,
          savedIds,
          workflow,
          preferredForm,
          edits: [],
        },
      });

      setResult(r);
      setShowingSample(
        Boolean(r.report.sample_requested && r.sampleUrl),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function revise() {
    if (!result || !editText.trim()) return;

    const all = [...edits, editText.trim()];
    const codes = result.report.form_codes ?? [
      result.report.form_code,
    ];

    const form = (
      codes.includes("25") && codes.includes("28")
        ? "25,28"
        : codes.includes("28")
          ? "28"
          : codes.includes("25")
            ? "25"
            : "auto"
    ) as typeof preferredForm;

    const src = result.report.source;

    try {
      setBusy("Applying your changes…");

      const r = await gen({
        data: {
          requestText: src?.requestText ?? requestText,
          files: src?.files ?? uploaded,
          savedIds: src?.savedIds ?? savedIds,
          workflow: result.report.workflow ?? workflow,
          preferredForm: src?.preferredForm ?? form,
          edits: all,
        },
      });

      setResult(r);
      setEdits(all);
      setEditText("");

      setShowingSample(
        Boolean(r.report.sample_requested && r.sampleUrl),
      );

      toast.success("Changes applied");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function startManualEdit() {
    if (!result?.report.forms?.length) {
      toast.error("No editable certificate fields are available.");
      return;
    }

    setShowingSample(false);

    setManualForms(
      result.report.forms.map((form) => ({
        ...form,
        fields: form.fields.map((field) => ({ ...field })),
      })),
    );

    setOpenManualSections({});
    setOpenCoveragePolicies({});
    setManualEditing(true);
  }

  function updateManualField(
    formIndex: number,
    fieldIndex: number,
    value: string,
  ) {
    setManualForms((current) =>
      current.map((form, fi) =>
        fi !== formIndex
          ? form
          : {
              ...form,
              fields: form.fields.map((field, fj) =>
                fj !== fieldIndex
                  ? field
                  : { ...field, value },
              ),
            },
      ),
    );
  }

  async function saveManualEdits() {
    if (!result || !manualForms.length) return;

    try {
      setManualSaving(true);
      setShowingSample(false);

      const updated = await updateFields({
        data: {
          id: result.id,
          forms: manualForms,
        },
      });

      setBlobUrls({});

      setResult((current) =>
        current
          ? {
              ...current,
              url: updated.url,
              report: updated.report,
            }
          : current,
      );

      setManualEditing(false);

      toast.success("Certificate updated.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the certificate.",
      );
    } finally {
      setManualSaving(false);
    }
  }

  function cancelManualEdit() {
    setManualEditing(false);
    setManualForms([]);
    setOpenManualSections({});
    setOpenCoveragePolicies({});
  }

  function prettyFieldName(name: string) {
    const labels: Record<string, string> = {
      Form_EditionIdentifier_A: "Form Edition",
      Form_CompletionDate_A: "Completion Date",

      Producer_FullName_A: "Producer",
      Producer_MailingAddress_LineOne_A: "Producer Address",
      Producer_MailingAddress_CityName_A: "Producer City",
      Producer_MailingAddress_StateOrProvinceCode_A: "Producer State",
      Producer_MailingAddress_PostalCode_A: "Producer ZIP Code",
      Producer_ContactPerson_FullName_A: "Contact Person",
      Producer_ContactPerson_PhoneNumber_A: "Phone",
      Producer_ContactPerson_EmailAddress_A: "Email",

      NamedInsured_FullName_A: "Named Insured",
      NamedInsured_MailingAddress_LineOne_A: "Insured Address",
      NamedInsured_MailingAddress_CityName_A: "Insured City",
      NamedInsured_MailingAddress_StateOrProvinceCode_A:
        "Insured State",
      NamedInsured_MailingAddress_PostalCode_A:
        "Insured ZIP Code",

      Insurer_FullName_A: "Carrier",
      Insurer_NAICCode_A: "NAIC Number",

      CertificateOfInsurance_CertificateNumberIdentifier_A:
        "Certificate Number",

      GeneralLiability_InsurerLetterCode_A: "Insurer Letter",
      GeneralLiability_CoverageIndicator_A:
        "General Liability",
      GeneralLiability_OccurrenceIndicator_A:
        "Occurrence",
      Policy_GeneralLiability_PolicyNumberIdentifier_A:
        "Policy Number",
      Policy_GeneralLiability_EffectiveDate_A:
        "Effective Date",
      Policy_GeneralLiability_ExpirationDate_A:
        "Expiration Date",

      GeneralLiability_EachOccurrence_LimitAmount_A:
        "Each Occurrence",
      GeneralLiability_FireDamageRentedPremises_EachOccurrenceLimitAmount_A:
        "Damage to Rented Premises",
      GeneralLiability_MedicalExpense_EachPersonLimitAmount_A:
        "Medical Expense",
      GeneralLiability_PersonalAndAdvertisingInjury_LimitAmount_A:
        "Personal & Advertising Injury",
      GeneralLiability_GeneralAggregate_LimitAmount_A:
        "General Aggregate",
      GeneralLiability_ProductsAndCompletedOperations_AggregateLimitAmount_A:
        "Products & Completed Operations Aggregate",
      GeneralLiability_GeneralAggregate_LimitAppliesPerProjectIndicator_A:
        "Aggregate Applies Per Project",
      GeneralLiability_OtherCoverageIndicator_A:
        "Other Coverage",
      GeneralLiability_OtherCoverageDescription_A:
        "Other Coverage Description",

      OtherPolicy_InsurerLetterCode_A: "Insurer Letter",
      OtherPolicy_OtherPolicyDescription_A:
        "Policy Description",
      OtherPolicy_PolicyNumberIdentifier_A:
        "Policy Number",
      OtherPolicy_PolicyEffectiveDate_A:
        "Effective Date",
      OtherPolicy_PolicyExpirationDate_A:
        "Expiration Date",
      OtherPolicy_CoverageCode_A: "Coverage Code",
      OtherPolicy_CoverageLimitAmount_A:
        "Coverage Limit",

      CertificateOfLiabilityInsurance_ACORDForm_RemarkText_A:
        "Description / Remarks",
    };

    return (
      labels[name] ??
      name
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  /*
   * Determines the five major areas of the manual editor.
   */
  function getFieldSection(name: string) {
    const n = name.toLowerCase();

    // 1. Named insured
    if (
      n.includes("namedinsured") ||
      n.includes("applicant")
    ) {
      return "Named Insured";
    }

    // 2. Carrier information
    if (
      n.includes("insurer_fullname") ||
      n.includes("insurer_naic") ||
      n.includes("carrier")
    ) {
      return "Carrier Info";
    }

    // 3. Certificate holder details
    if (
      n.includes("certificateholder") ||
      n.includes("certificate_holder") ||
      n.includes("holder") ||
      n.includes("mortgagee") ||
      n.includes("loss payee") ||
      n.includes("losspayee") ||
      n.includes("loss_payee")
    ) {
      return "Cert Holder Detail";
    }

    // 4. Description / remarks
    if (
      n.includes("certificateofliabilityinsurance") ||
      n.includes("remark") ||
      n.includes("specialinstruction") ||
      n.includes("special_instruction")
    ) {
      return "Description / Remarks";
    }

    // 5. Coverage
    if (
      n.includes("generalliability") ||
      n.includes("policy_generalliability") ||
      n.includes("automobile") ||
      n.includes("autoliability") ||
      n.includes("hired") ||
      n.includes("nonowned") ||
      n.includes("umbrella") ||
      n.includes("excess") ||
      n.includes("workers") ||
      n.includes("employersliability") ||
      n.includes("workerscompensation") ||
      n.includes("property") ||
      n.includes("building") ||
      n.includes("otherpolicy") ||
      n.includes("coveragecode") ||
      n.includes("coveragelimit")
    ) {
      return "Coverage Info";
    }

    return "Other";
  }

  /*
   * Determines the policy subsection inside Coverage Info.
   */
  function getCoveragePolicy(name: string) {
    const n = name.toLowerCase();

    if (
      n.includes("generalliability") ||
      n.includes("policy_generalliability")
    ) {
      return "General Liability";
    }

    if (
      n.includes("automobile") ||
      n.includes("autoliability") ||
      n.includes("hired") ||
      n.includes("nonowned")
    ) {
      return "Automobile Liability";
    }

    if (
      n.includes("umbrella") ||
      n.includes("excess")
    ) {
      return "Umbrella / Excess";
    }

    if (
      n.includes("workers") ||
      n.includes("employersliability") ||
      n.includes("workerscompensation")
    ) {
      return "Workers Compensation";
    }

    if (
      n.includes("property") ||
      n.includes("building") ||
      n.includes("businesspersonal") ||
      n.includes("contents") ||
      n.includes("deductible")
    ) {
      return "Property";
    }

    if (n.includes("otherpolicy")) {
      return "Other";
    }

    return "Other";
  }

  function isLongField(name: string) {
    return (
      name ===
        "GeneralLiability_OtherCoverageDescription_A" ||
      name ===
        "OtherPolicy_OtherPolicyDescription_A" ||
      name ===
        "CertificateOfLiabilityInsurance_ACORDForm_RemarkText_A"
    );
  }

  function isCheckboxField(name: string) {
    return (
      name ===
        "GeneralLiability_CoverageIndicator_A" ||
      name ===
        "GeneralLiability_OccurrenceIndicator_A" ||
      name ===
        "GeneralLiability_GeneralAggregate_LimitAppliesPerProjectIndicator_A" ||
      name ===
        "GeneralLiability_OtherCoverageIndicator_A"
    );
  }

  function sectionIcon(section: string) {
    switch (section) {
      case "Named Insured":
        return <User className="h-4 w-4" />;

      case "Carrier Info":
        return <Landmark className="h-4 w-4" />;

      case "Coverage Info":
        return <ShieldCheck className="h-4 w-4" />;

      case "Description / Remarks":
        return <FileText className="h-4 w-4" />;

      case "Cert Holder Detail":
        return <Home className="h-4 w-4" />;

      default:
        return <FileText className="h-4 w-4" />;
    }
  }

  function coverageIcon(policy: string) {
    switch (policy) {
      case "General Liability":
        return <ShieldCheck className="h-4 w-4" />;

      case "Automobile Liability":
        return <Car className="h-4 w-4" />;

      case "Umbrella / Excess":
        return <Umbrella className="h-4 w-4" />;

      case "Workers Compensation":
        return <BriefcaseBusiness className="h-4 w-4" />;

      case "Property":
        return <Home className="h-4 w-4" />;

      default:
        return <FileText className="h-4 w-4" />;
    }
  }

  function renderField(
    field: ManualField,
    formIndex: number,
    fieldIndex: number,
  ) {
    const longField = isLongField(field.name);
    const checkboxField = isCheckboxField(field.name);

    if (checkboxField) {
      return (
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3 transition hover:bg-muted/40">
          <input
            type="checkbox"
            checked={field.value === "true"}
            onChange={(e) =>
              updateManualField(
                formIndex,
                fieldIndex,
                e.target.checked ? "true" : "false",
              )
            }
            className="h-4 w-4"
          />

          <span className="text-sm font-medium">
            {prettyFieldName(field.name)}
          </span>
        </label>
      );
    }

    if (longField) {
      return (
        <textarea
          value={field.value}
          onChange={(e) =>
            updateManualField(
              formIndex,
              fieldIndex,
              e.target.value,
            )
          }
          rows={4}
          className="min-h-24 w-full resize-y rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring"
        />
      );
    }

    return (
      <input
        type="text"
        value={field.value}
        onChange={(e) =>
          updateManualField(
            formIndex,
            fieldIndex,
            e.target.value,
          )
        }
        className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring"
      />
    );
  }

  function renderStandardSection(
    form: ManualForm,
    formIndex: number,
    sectionName: string,
    fields: {
      field: ManualField;
      fieldIndex: number;
    }[],
  ) {
    const sectionKey = `${form.form_code}-${sectionName}`;
    const isOpen =
      openManualSections[sectionKey] ?? true;

    return (
      <div
        key={sectionName}
        className="overflow-hidden rounded-xl border bg-background"
      >
        <button
          type="button"
          onClick={() =>
            setOpenManualSections((current) => ({
              ...current,
              [sectionKey]: !isOpen,
            }))
          }
          className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-muted/40"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              {sectionIcon(sectionName)}
            </span>

            <div>
              <div className="text-sm font-semibold">
                {sectionName}
              </div>

              <div className="text-xs text-muted-foreground">
                {fields.length}{" "}
                {fields.length === 1 ? "field" : "fields"}
              </div>
            </div>
          </div>

          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {isOpen && (
          <div className="border-t px-4 py-4">
            <div className="space-y-4">
              {fields.map(({ field, fieldIndex }) => {
                const checkboxField = isCheckboxField(
                  field.name,
                );

                return (
                  <div key={`${field.name}-${fieldIndex}`}>
                    {!checkboxField && (
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        {prettyFieldName(field.name)}
                      </label>
                    )}

                    {renderField(
                      field,
                      formIndex,
                      fieldIndex,
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderCoverageSection(
    form: ManualForm,
    formIndex: number,
    fields: {
      field: ManualField;
      fieldIndex: number;
    }[],
  ) {
    const sectionKey = `${form.form_code}-Coverage Info`;
    const isOpen =
      openManualSections[sectionKey] ?? true;

    const policyGroups = Array.from(
      fields.reduce(
        (groups, item) => {
          const policy = getCoveragePolicy(
            item.field.name,
          );

          if (!groups.has(policy)) {
            groups.set(policy, []);
          }

          groups.get(policy)!.push(item);

          return groups;
        },
        new Map<string, typeof fields>(),
      ),
    );

    return (
      <div className="overflow-hidden rounded-xl border bg-background">
        <button
          type="button"
          onClick={() =>
            setOpenManualSections((current) => ({
              ...current,
              [sectionKey]: !isOpen,
            }))
          }
          className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-muted/40"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              {sectionIcon("Coverage Info")}
            </span>

            <div>
              <div className="text-sm font-semibold">
                Coverage Info
              </div>

              <div className="text-xs text-muted-foreground">
                Organized by policy
              </div>
            </div>
          </div>

          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {isOpen && (
          <div className="space-y-2 border-t p-3">
            {policyGroups.map(
              ([policyName, policyFields]) => {
                const policyKey = `${form.form_code}-${policyName}`;
                const policyOpen =
                  openCoveragePolicies[policyKey] ??
                  true;

                return (
                  <div
                    key={policyName}
                    className="overflow-hidden rounded-lg border bg-muted/10"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenCoveragePolicies(
                          (current) => ({
                            ...current,
                            [policyKey]: !policyOpen,
                          }),
                        )
                      }
                      className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-background">
                          {coverageIcon(policyName)}
                        </span>

                        <div>
                          <div className="text-sm font-semibold">
                            {policyName}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {policyFields.length}{" "}
                            {policyFields.length === 1
                              ? "field"
                              : "fields"}
                          </div>
                        </div>
                      </div>

                      {policyOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {policyOpen && (
                      <div className="border-t bg-background px-4 py-4">
                        <div className="space-y-4">
                          {policyFields.map(
                            ({
                              field,
                              fieldIndex,
                            }) => {
                              const checkboxField =
                                isCheckboxField(
                                  field.name,
                                );

                              return (
                                <div
                                  key={`${field.name}-${fieldIndex}`}
                                >
                                  {!checkboxField && (
                                    <label className="mb-1.5 block text-xs font-semibold">
                                      {prettyFieldName(
                                        field.name,
                                      )}
                                    </label>
                                  )}

                                  {renderField(
                                    field,
                                    formIndex,
                                    fieldIndex,
                                  )}
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>
    );
  }

  async function saveInsurance() {
    const files = uploaded
      .filter((u) => u.role === "insurance")
      .map(({ path, name, mime }) => ({
        path,
        name,
        mime,
      }));

    if (!files.length) return;

    try {
      await save({
        data: {
          files,
          label: result?.insured || undefined,
        },
      });

      setSavedToLib(true);
      docs.refetch();

      toast.success("Saved to your library");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function reset() {
    setResult(null);
    setShowingSample(false);
    setEdits([]);
    setEditText("");
    setRequestFiles([]);
    setInsFiles([]);
    setRequestText("");
    setSavedIds([]);
    setUploaded([]);
    setManualForms([]);
    setManualEditing(false);
    setManualSaving(false);
    setOpenManualSections({});
    setOpenCoveragePolicies({});
  }

  if (busy) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 text-center">
        <div className="h-14 w-14 animate-breathe rounded-full bg-accent" />

        <p className="font-serif text-2xl text-primary">
          {busy}
        </p>

        <p className="max-w-sm text-sm text-muted-foreground">
          This usually takes a minute or two. Policies are
          read carefully so nothing is invented.
        </p>
      </div>
    );
  }

  if (result) {
    const activeUrl = showingSample
      ? result.sampleUrl
      : result.url;

    const previewSrc = activeUrl
      ? blobUrls[activeUrl] ?? null
      : null;

    return (
      <>
        <PageTitle
          title={
            result.report.workflow === "application"
              ? "Commercial application ready"
              : result.report.form_codes?.length === 2
                ? "ACORD 25 + 28 package ready"
                : `ACORD ${result.report.form_code} ready`
          }
          sub={result.report.summary}
        />

        <div className="mb-6 flex flex-wrap gap-3">
          {activeUrl && (
            <Button asChild>
              <a
                href={activeUrl}
                target="_blank"
                rel="noreferrer"
                download
              >
                <Download className="h-4 w-4" />

                {showingSample
                  ? "Download sample"
                  : "Download PDF"}
              </a>
            </Button>
          )}

          {result.report.workflow === "certificate" &&
            result.sampleUrl && (
              <Button
                variant="outline"
                onClick={() =>
                  setShowingSample((value) => !value)
                }
              >
                <Stamp className="h-4 w-4" />

                {showingSample
                  ? "View issued certificate"
                  : "Create sample"}
              </Button>
            )}

          {uploaded.some(
            (u) => u.role === "insurance",
          ) && (
            <Button
              variant="outline"
              onClick={saveInsurance}
              disabled={savedToLib}
            >
              <BookmarkPlus className="h-4 w-4" />

              {savedToLib
                ? "Saved to library"
                : "Save these policies"}
            </Button>
          )}

          <Button variant="ghost" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Start another
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* PDF Preview */}
          <Panel className="min-w-0 overflow-hidden p-0">
            {activeUrl ? (
              previewSrc ? (
                <iframe
                  key={previewSrc}
                  title={
                    showingSample
                      ? "Sample certificate preview"
                      : "Document preview"
                  }
                  src={`${previewSrc}#view=FitH&navpanes=0`}
                  className="block h-[85vh] min-h-[900px] w-full bg-card"
                />
              ) : (
                <p className="flex h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading preview…
                </p>
              )
            ) : (
              <p className="p-6 text-sm text-muted-foreground">
                Preview unavailable.
              </p>
            )}
          </Panel>

          {/* Right Sidebar */}
          <div className="min-w-0 space-y-4">
            <Panel className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base">
                    Manual editing
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Edit the certificate fields directly,
                    then save the updated PDF.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={startManualEdit}
                  disabled={!result.report.forms?.length}
                >
                  Edit fields
                </Button>
              </div>
            </Panel>

            <Panel className="p-5">
              <h2 className="mb-1 text-base">
                Make changes
              </h2>

              <p className="mb-3 text-sm text-muted-foreground">
                Tell the assistant what to fix, e.g.
                "change holder address to 5 Main St" or
                "remove the umbrella".
              </p>

              <Textarea
                value={editText}
                onChange={(e) =>
                  setEditText(e.target.value)
                }
                placeholder="Describe the edit…"
                className="mb-3 min-h-24 bg-background"
              />

              {!!editId &&
                !result.report.source && (
                  <p className="mb-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
                    This certificate was made before
                    editing was added, so its original
                    documents weren't linked. Create it
                    again from the New certificate page
                    to edit it.
                  </p>
                )}

              {edits.length > 0 && (
                <ul className="mb-3 space-y-1 text-xs text-muted-foreground">
                  {edits.map((t, i) => (
                    <li key={i}>
                      Applied: {t}
                    </li>
                  ))}
                </ul>
              )}

              <Button
                onClick={revise}
                disabled={
                  !editText.trim() ||
                  (!!editId &&
                    !result.report.source)
                }
                className="w-full"
              >
                <Wand2 className="h-4 w-4" />
                Apply changes
              </Button>
            </Panel>

            <ReportView report={result.report} />
          </div>
        </div>

        {/* FULL-SCREEN MANUAL EDITOR */}
        {manualEditing && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
            <div className="min-h-screen">

              {/* Header */}
              <div className="sticky top-0 z-10 border-b bg-background/95 px-6 py-4 backdrop-blur">
                <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <FileText className="h-4 w-4" />
                    </div>

                    <div>
                      <h1 className="text-lg font-semibold">
                        Manual Edit
                      </h1>

                      <p className="text-xs text-muted-foreground">
                        Edit the certificate using the general structure of the ACORD form.
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelManualEdit}
                      disabled={manualSaving}
                    >
                      Cancel
                    </Button>

                    <Button
                      type="button"
                      onClick={saveManualEdits}
                      disabled={manualSaving}
                    >
                      {manualSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save changes"
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Editor Content */}
              <div className="mx-auto max-w-[1500px] px-6 py-8">
                {manualForms.map(
                  (form, formIndex) => {
                    const sections = Array.from(
                      form.fields.reduce(
                        (groups, field, fieldIndex) => {
                          const section =
                            getFieldSection(field.name);

                          if (!groups.has(section)) {
                            groups.set(section, []);
                          }

                          groups
                            .get(section)!
                            .push({
                              field,
                              fieldIndex,
                            });

                          return groups;
                        },
                        new Map<
                          string,
                          {
                            field: ManualField;
                            fieldIndex: number;
                          }[]
                        >(),
                      ),
                    );

                    return (
                      <div
                        key={`${form.form_code}-${formIndex}`}
                        className="space-y-6"
                      >
                        {/* Form Header */}
                        <div className="flex items-end justify-between border-b pb-4">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Certificate Form
                            </p>

                            <h2 className="mt-1 text-2xl font-semibold">
                              ACORD {form.form_code}
                            </h2>
                          </div>

                          <div className="rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                            {form.fields.length} editable fields
                          </div>
                        </div>

                        {/* Sections */}
                        <div className="space-y-5">
                          {sections.map(
                            ([
                              sectionName,
                              fields,
                            ]) => {
                              if (
                                sectionName ===
                                "Coverage Info"
                              ) {
                                return (
                                  <div
                                    key={sectionName}
                                    className="rounded-xl border bg-card shadow-sm"
                                  >
                                    <div className="border-b bg-muted/30 px-5 py-3">
                                      <h3 className="text-sm font-semibold uppercase tracking-wide">
                                        Coverage Information
                                      </h3>

                                      <p className="mt-0.5 text-xs text-muted-foreground">
                                        Policy and coverage details
                                      </p>
                                    </div>

                                    <div className="p-4">
                                      {renderCoverageSection(
                                        form,
                                        formIndex,
                                        fields,
                                      )}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={sectionName}
                                  className="rounded-xl border bg-card shadow-sm"
                                >
                                  {renderStandardSection(
                                    form,
                                    formIndex,
                                    sectionName,
                                    fields,
                                  )}
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>
                    );
                  },
                )}

                {/* Bottom Save Bar */}
                <div className="mt-8 flex items-center justify-between rounded-xl border bg-muted/30 px-5 py-4">
                  <div>
                    <p className="text-sm font-medium">
                      Finished making your changes?
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Saving will regenerate the certificate PDF with your edits.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelManualEdit}
                      disabled={manualSaving}
                    >
                      Cancel
                    </Button>

                    <Button
                      type="button"
                      onClick={saveManualEdits}
                      disabled={manualSaving}
                    >
                      {manualSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save changes"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const noForms =
    tpls.data && tpls.data.length === 0;

  return (
    <div>
      <PageTitle
        title="Create a certificate"
        sub="Start with ACORD 25 or 28. The assistant fills only what the insurance documents support and clearly flags anything missing."
      />

      {noForms && (
        <div className="mb-6 rounded-xl bg-warning-soft px-5 py-4 text-sm text-warning-foreground">
          No blank ACORD forms installed yet — add them
          on the Forms page before generating.
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setWorkflow("certificate");
            setPreferredForm("25");
          }}
          className={`h-auto min-h-28 items-start justify-start gap-4 whitespace-normal p-5 text-left shadow-none ${
            workflow === "certificate" &&
            preferredForm === "25"
              ? "border-primary bg-secondary"
              : "bg-card hover:border-primary/50"
          }`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>

          <span>
            <strong className="block text-base">
              ACORD 25
            </strong>

            <span className="mt-1 block text-sm text-muted-foreground">
              Liability certificate
            </span>
          </span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setWorkflow("certificate");
            setPreferredForm("28");
          }}
          className={`h-auto min-h-28 items-start justify-start gap-4 whitespace-normal p-5 text-left shadow-none ${
            workflow === "certificate" &&
            preferredForm === "28"
              ? "border-primary bg-secondary"
              : "bg-card hover:border-primary/50"
          }`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </span>

          <span>
            <strong className="block text-base">
              ACORD 28
            </strong>

            <span className="mt-1 block text-sm text-muted-foreground">
              Commercial property evidence
            </span>
          </span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setWorkflow("certificate");
            setPreferredForm("25,28");
          }}
          className={`h-auto min-h-28 items-start justify-start gap-4 whitespace-normal p-5 text-left shadow-none sm:col-span-2 lg:col-span-1 ${
            workflow === "certificate" &&
            preferredForm === "25,28"
              ? "border-primary bg-secondary"
              : "bg-card hover:border-primary/50"
          }`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Files className="h-5 w-5" />
          </span>

          <span>
            <strong className="block text-base">
              ACORD 25 + 28
            </strong>

            <span className="mt-1 block text-sm text-muted-foreground">
              Liability and commercial property
            </span>
          </span>
        </Button>
      </div>

      <div className="mb-7 border-b border-border pb-5">
        <p className="text-sm text-muted-foreground">
          Choose the certificate form you want. ACORD
          101 is added automatically when more space is
          needed.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel>
          <h2 className="mb-1 text-lg">
            1. The request
          </h2>

          <p className="mb-4 text-sm text-muted-foreground">
            Paste the email or upload the request.
            Optional — if left blank, the certificate
            goes to the mortgagee in the documents.
          </p>

          <Textarea
            value={requestText}
            onChange={(e) =>
              setRequestText(e.target.value)
            }
            placeholder="e.g. Please issue a COI to ABC Holdings LLC, 12 Main St… naming them additional insured on a primary & non-contributory basis…"
            className="mb-4 min-h-36 bg-background"
          />

          <DropZone
            label="Upload request"
            hint="PDF, image, email, or Outlook message"
            files={requestFiles}
            onChange={setRequestFiles}
          />
        </Panel>

        <Panel>
          <h2 className="mb-1 text-lg">
            2. Insurance documents
          </h2>

          <p className="mb-4 text-sm text-muted-foreground">
            Policies, binders, proposals, quotes,
            endorsements.
          </p>

          <DropZone
            label="Upload documents"
            hint="These are the source of truth"
            files={insFiles}
            onChange={setInsFiles}
          />

          {docs.data &&
            docs.data.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  From your library
                </p>

                <ul className="max-h-48 space-y-1 overflow-auto">
                  {docs.data.map((d) => (
                    <li key={d.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                        <Checkbox
                          checked={savedIds.includes(
                            d.id,
                          )}
                          onCheckedChange={(c) =>
                            setSavedIds((s) =>
                              c
                                ? [...s, d.id]
                                : s.filter(
                                    (x) =>
                                      x !== d.id,
                                  ),
                            )
                          }
                        />

                        <span className="truncate">
                          {d.name}
                        </span>

                        {d.label && (
                          <span className="ml-auto truncate text-xs text-muted-foreground">
                            {d.label}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </Panel>
      </div>

      <div className="mt-8 flex justify-end">
        <Button
          size="lg"
          onClick={run}
          disabled={!canRun || !!noForms}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}

          {workflow === "application"
            ? "Create application"
            : "Generate certificate"}
        </Button>
      </div>
    </div>
  );
}