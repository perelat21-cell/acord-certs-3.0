import { supabase } from "@/integrations/supabase/client";
import { createUploadUrl } from "./cert.functions";

export function safeName(name: string) {
  return name.replace(/[^A-Za-z0-9._\-]/g, "_").slice(-120);
}

export async function uploadFile(path: string, file: File) {
  const { path: p, token } = await createUploadUrl({ data: { path } });
const { error } = await supabase.storage
  .from("acord")
  .uploadToSignedUrl(p, token, file, {
    contentType:
      file.type ||
      (file.name.toLowerCase().endsWith(".xlsx")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : file.name.toLowerCase().endsWith(".xls")
          ? "application/vnd.ms-excel"
          : file.name.toLowerCase().endsWith(".csv")
            ? "text/csv"
            : file.name.toLowerCase().endsWith(".pdf")
              ? "application/pdf"
              : "application/octet-stream"),
  });
  if (error) throw new Error(error.message);
  return p;
}
