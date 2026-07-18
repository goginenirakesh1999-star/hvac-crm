import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { isValidTwilioRequest, sendSms } from "@/lib/twilio";
import { parseOwnerCommand, type OwnerCommand } from "@/lib/owner-commands";

function twiml(message: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}

const HELP_TEXT =
  "Commands: QUOTE [phone] $[amount] [description] or INVOICE [phone] $[amount] [description]";

// Blueprint Task 4: the owner's SMS command center. Owners text QUOTE/INVOICE
// commands to their business number; we create the Stripe artifact and text
// the payment link straight to the customer.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params = Object.fromEntries(
    [...form.entries()].map(([k, v]) => [k, String(v)])
  );

  if (
    !isValidTwilioRequest(
      req.headers.get("x-twilio-signature"),
      "/api/webhooks/twilio/incoming-sms",
      params
    )
  ) {
    return new NextResponse("invalid signature", { status: 403 });
  }

  const from = params.From;
  const businessNumber = params.To;
  const body = params.Body ?? "";

  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, owner_phone, twilio_phone_number, stripe_connect_account_id")
    .eq("owner_phone", from)
    .maybeSingle();

  // Not the owner — an ordinary inbound customer SMS. Phase 2 scope is the
  // command center only; acknowledge without replying.
  if (!tenant) return new NextResponse("<Response/>", { headers: { "Content-Type": "text/xml" } });

  const command = parseOwnerCommand(body);
  if (!command) return twiml(HELP_TEXT);

  try {
    const url =
      command.kind === "quote"
        ? await createQuoteLink(tenant.id, tenant.name, command)
        : await createInvoice(tenant.id, tenant.name, command);

    await sendSms(
      command.phone,
      tenant.twilio_phone_number ?? businessNumber,
      command.kind === "quote"
        ? `${tenant.name}: ${command.description} — $${command.amount}. Pay here: ${url}`
        : `${tenant.name}: your invoice for "${command.description}" ($${command.amount}) is ready: ${url}`
    );

    return twiml(
      `${command.kind.toUpperCase()} for $${command.amount} sent to ${command.phone}.`
    );
  } catch (err) {
    console.error("incoming-sms command error:", err);
    return twiml("Something went wrong creating that. Please try again.");
  }
}

async function insertJob(
  tenantId: string,
  command: OwnerCommand,
  stripeInvoiceId: string | null
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      tenant_id: tenantId,
      customer_phone: command.phone,
      description: command.description,
      quoted_price: command.amount,
      status: "pending",
      stripe_invoice_id: stripeInvoiceId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function createQuoteLink(
  tenantId: string,
  tenantName: string,
  command: OwnerCommand
): Promise<string> {
  const jobId = await insertJob(tenantId, command, null);
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(command.amount * 100),
          product_data: { name: `${tenantName}: ${command.description}` },
        },
      },
    ],
    metadata: { job_id: jobId, tenant_id: tenantId },
    success_url: "https://checkout.stripe.com/success",
  });
  if (!session.url) throw new Error("Stripe session has no URL");
  return session.url;
}

async function createInvoice(
  tenantId: string,
  tenantName: string,
  command: OwnerCommand
): Promise<string> {
  const stripe = getStripe();
  const jobId = await insertJob(tenantId, command, null);

  const existing = await stripe.customers.search({
    query: `phone:"${command.phone}" AND metadata["tenant_id"]:"${tenantId}"`,
    limit: 1,
  });
  const customer =
    existing.data[0] ??
    (await stripe.customers.create({
      phone: command.phone,
      name: command.phone,
      metadata: { tenant_id: tenantId },
    }));

  const invoice = await stripe.invoices.create({
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: 7,
    metadata: { job_id: jobId, tenant_id: tenantId },
  });
  await stripe.invoiceItems.create({
    customer: customer.id,
    invoice: invoice.id,
    amount: Math.round(command.amount * 100),
    currency: "usd",
    description: `${tenantName}: ${command.description}`,
  });
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id!);

  const supabase = createAdminClient();
  await supabase.from("jobs").update({ stripe_invoice_id: finalized.id }).eq("id", jobId);

  if (!finalized.hosted_invoice_url) throw new Error("Invoice has no hosted URL");
  return finalized.hosted_invoice_url;
}
