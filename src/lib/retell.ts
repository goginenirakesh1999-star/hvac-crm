import "server-only";

interface CreateRetellCallArgs {
  fromNumber: string;
  toNumber: string;
  tenantId: string;
  dynamicVariables?: Record<string, string>;
}

// https://docs.retellai.com/api-references/create-phone-call
export async function createRetellCall({
  fromNumber,
  toNumber,
  tenantId,
  dynamicVariables,
}: CreateRetellCallArgs) {
  const res = await fetch("https://api.retellai.com/v2/create-phone-call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from_number: fromNumber,
      to_number: toNumber,
      override_agent_id: process.env.RETELL_AGENT_ID,
      metadata: { tenant_id: tenantId },
      retell_llm_dynamic_variables: dynamicVariables ?? {},
    }),
  });
  if (!res.ok) {
    throw new Error(`Retell create-phone-call failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
