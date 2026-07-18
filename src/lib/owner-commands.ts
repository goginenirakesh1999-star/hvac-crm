// Parses the owner's SMS commands per the blueprint:
//   QUOTE [Phone Number] $[Amount] [Description]
//   INVOICE [Phone Number] $[Amount] [Description]

export interface OwnerCommand {
  kind: "quote" | "invoice";
  phone: string; // E.164
  amount: number; // dollars
  description: string;
}

const COMMAND_RE =
  /^\s*(quote|invoice)\s+(\+?[\d\-\s().]+?)\s+\$?(\d+(?:\.\d{1,2})?)\s+(\S.*)$/is;

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function parseOwnerCommand(body: string): OwnerCommand | null {
  const m = COMMAND_RE.exec(body);
  if (!m) return null;
  const phone = normalizePhone(m[2]);
  if (!phone) return null;
  return {
    kind: m[1].toLowerCase() as OwnerCommand["kind"],
    phone,
    amount: Number(m[3]),
    description: m[4].trim(),
  };
}
