import { describe, expect, it } from "vitest";
import { parseOwnerCommand } from "./owner-commands";

describe("parseOwnerCommand", () => {
  it("parses a QUOTE command", () => {
    expect(parseOwnerCommand("QUOTE +15551234567 $250 AC compressor repair")).toEqual({
      kind: "quote",
      phone: "+15551234567",
      amount: 250,
      description: "AC compressor repair",
    });
  });

  it("parses an INVOICE command", () => {
    expect(parseOwnerCommand("INVOICE +15551234567 $89.50 Diagnostic visit")).toEqual({
      kind: "invoice",
      phone: "+15551234567",
      amount: 89.5,
      description: "Diagnostic visit",
    });
  });

  it("is case-insensitive on the verb", () => {
    expect(parseOwnerCommand("quote +15551234567 $100 Tune-up")?.kind).toBe("quote");
  });

  it("normalizes bare 10-digit US numbers to E.164", () => {
    expect(parseOwnerCommand("QUOTE 5551234567 $100 Tune-up")?.phone).toBe("+15551234567");
  });

  it("normalizes formatted numbers like (555) 123-4567", () => {
    expect(parseOwnerCommand("QUOTE (555) 123-4567 $100 Tune-up")?.phone).toBe("+15551234567");
  });

  it("accepts amounts without a dollar sign", () => {
    expect(parseOwnerCommand("INVOICE 5551234567 175 Blower motor")?.amount).toBe(175);
  });

  it("returns null for ordinary text", () => {
    expect(parseOwnerCommand("Hey, how's the Smith job going?")).toBeNull();
  });

  it("returns null when description is missing", () => {
    expect(parseOwnerCommand("QUOTE 5551234567 $100")).toBeNull();
  });

  it("returns null for an invalid phone number", () => {
    expect(parseOwnerCommand("QUOTE 12345 $100 Tune-up")).toBeNull();
  });
});
