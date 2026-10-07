import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DropZone({
  label,
  hint,
  files,
  onChange,
  accept = ".pdf,.png,.jpg,.jpeg,.txt,.eml,.msg",
  multiple = true,
}: {
  label: string;
  hint: string;
  files: File[];
  onChange: (f: File[]) => void;
  accept?: string;
  multiple?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const add = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    onChange(multiple ? [...files, ...arr] : arr.slice(0, 1));
  };
  return (
    <div>
      <Button
        variant="outline"
        type="button"
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={`h-auto w-full flex-col gap-2 border-dashed px-6 py-8 text-center shadow-none ${
          over ? "border-primary bg-secondary" : "border-input bg-muted/40 hover:bg-muted"
        }`}
      >
        <Upload className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </Button>
      <input
        ref={ref}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              <span className="truncate">{f.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${f.name}`}
                className="ml-auto h-7 w-7 text-muted-foreground"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
