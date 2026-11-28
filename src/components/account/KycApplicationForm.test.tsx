import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  KycApplicationRecord,
  KycDocumentRecord,
} from "@/lib/real-estate/kyc";

vi.mock("@/lib/real-estate/kyc-actions", () => ({
  saveKycApplicationAction: vi.fn(),
  uploadKycDocumentAction: vi.fn(),
  removeKycDocumentAction: vi.fn(),
}));

import { KycApplicationForm } from "./KycApplicationForm";

const APPLICATION: KycApplicationRecord = {
  id: "app-1",
  userId: "user-1",
  membershipType: "landlord",
  status: "draft",
  fullLegalName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+237600000000",
  countryOfResidence: "Cameroon",
  currentLocation: "Limbe",
  residencyStatus: "permanent",
  dateOfBirth: "1990-01-01",
  idType: "national_id_card",
  idIssuingCountry: "Cameroon",
  idNumberLast4: "1234",
  videoConsentAt: null,
  declarationAcceptedAt: null,
  submittedAt: null,
  reviewedAt: null,
  reviewedBy: null,
  decisionReason: null,
  internalNotes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function document(
  kind: KycDocumentRecord["kind"],
  id: string,
): KycDocumentRecord {
  return {
    id,
    applicationId: "app-1",
    kind,
    originalFilename: `${kind}.jpg`,
    detectedMime: "image/jpeg",
    byteSize: 1024,
    issuingCountry: "Cameroon",
    note: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("KycApplicationForm", () => {
  it("shows the requirements in the order the applicant works through them", () => {
    const { container } = render(
      <KycApplicationForm
        membershipType="landlord"
        application={APPLICATION}
        documents={[]}
        locale="en"
      />,
    );

    const text = container.textContent ?? "";
    const order = [
      "Personal information",
      "Identity document",
      "Face video",
      "Declaration and consent",
    ].map((label) => text.indexOf(label));

    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("offers a passport as an accepted identity document", () => {
    render(
      <KycApplicationForm
        membershipType="landlord"
        application={APPLICATION}
        documents={[]}
        locale="en"
      />,
    );

    expect(
      screen.getAllByText(/international passport/i).length,
    ).toBeGreaterThan(0);
  });

  it("has no separate Upload button", () => {
    render(
      <KycApplicationForm
        membershipType="landlord"
        application={APPLICATION}
        documents={[]}
        locale="en"
      />,
    );

    expect(screen.queryByRole("button", { name: /^upload$/i })).toBeNull();
  });

  it("marks every application field as required", () => {
    render(
      <KycApplicationForm
        membershipType="landlord"
        application={APPLICATION}
        documents={[]}
        locale="en"
      />,
    );

    for (const label of [
      /full legal name/i,
      /email address/i,
      /phone number/i,
      /date of birth/i,
      /country of residence/i,
      /current location/i,
      /residency status/i,
      /document type/i,
      /issuing country/i,
      /last 4 characters/i,
    ]) {
      expect(screen.getByLabelText(label)).toHaveAttribute("required");
    }
  });

  it("enables submission once a passport and face video are uploaded", () => {
    render(
      <KycApplicationForm
        membershipType="landlord"
        application={APPLICATION}
        documents={[
          document("passport", "doc-1"),
          document("face_video", "doc-2"),
        ]}
        locale="en"
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "Submit for review" })[0]!,
    );
    const submit = screen
      .getAllByRole("button", { name: "Submit for review" })
      .at(-1);
    expect(submit?.hasAttribute("disabled")).toBe(false);
  });

  it("does not let an applicant submit before the required documents exist", () => {
    render(
      <KycApplicationForm
        membershipType="landlord"
        application={APPLICATION}
        documents={[]}
        locale="en"
      />,
    );

    expect(
      screen.getByText(/upload the required identity document and face video/i),
    ).toBeTruthy();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Submit for review" })[0]!,
    );
    const submit = screen
      .getAllByRole("button", { name: "Submit for review" })
      .at(-1);
    expect(submit?.hasAttribute("disabled")).toBe(true);
  });
});
