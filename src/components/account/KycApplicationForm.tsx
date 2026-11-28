"use client";

import { useActionState, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { SelectField, TextField } from "@/components/ui/Form";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  saveKycApplicationAction,
  type KycActionState,
} from "@/lib/real-estate/kyc-actions";
import {
  KYC_ID_TYPES,
  KYC_REQUIREMENTS,
  KYC_RESIDENCY_STATUSES,
  hasIdentityDocument,
  isKycDecidedStatus,
  kycIdTypeLabelKey,
  kycRequirementBodyKey,
  kycRequirementLabelKey,
  kycResidencyStatusLabelKey,
  kycStatusLabelKey,
  type KycApplicationRecord,
  type KycDocumentRecord,
  type KycMembershipType,
  type KycRequirementKey,
} from "@/lib/real-estate/kyc";
import { KYC_ERROR_KEYS } from "@/lib/validation/kyc";

import { KycDocumentUpload } from "./KycDocumentUpload";

/**
 * The KYC application form.
 *
 * Two submit paths over one field set: "save and continue later" writes a draft,
 * and "submit for review" writes a submitted application once both consents are
 * ticked. Both post to the same Server Action with a different `intent`, so a
 * draft is never a different shape from a submission.
 *
 * The document uploader is a separate island, because it posts multipart bodies
 * of its own; keeping it out of the form means a large upload never re-sends the
 * whole application, and the file inputs are never part of the application POST.
 *
 * `t` is built here from a serializable `locale` rather than passed in: a
 * translator is a closure and cannot cross the Server/Client boundary.
 */
export function KycApplicationForm({
  membershipType,
  application,
  documents,
  locale,
}: {
  membershipType: KycMembershipType;
  application: KycApplicationRecord | null;
  documents: KycDocumentRecord[];
  locale: Locale;
}) {
  const t = createTranslator(locale).t;

  const [state, submitAction, submitting] = useActionState(
    saveKycApplicationAction.bind(null, membershipType, "submit", locale),
    null as KycActionState | null,
  );
  const [draftState, draftAction, savingDraft] = useActionState(
    saveKycApplicationAction.bind(null, membershipType, "draft", locale),
    null as KycActionState | null,
  );

  const [consentOpen, setConsentOpen] = useState(false);

  const errorState = state && !state.ok ? state : null;
  // The action returns stable field-message keys, mapped through
  // `KYC_ERROR_KEYS` so a field the schema adds cannot render its raw key.
  const fieldError = (
    field: keyof typeof KYC_ERROR_KEYS,
  ): string | undefined =>
    errorState?.fields?.[field]
      ? t(`account.kyc.${KYC_ERROR_KEYS[field]}`)
      : undefined;

  const isApproved = application?.status === "approved";
  const isDecided =
    application !== null && isKycDecidedStatus(application.status);
  const readOnly = isApproved;

  const uploadedKinds = documents.map((document) => document.kind);
  const identityUploaded = hasIdentityDocument(uploadedKinds);
  const videoUploaded = uploadedKinds.includes("face_video");
  const documentsReady = identityUploaded && videoUploaded;
  const personalComplete = Boolean(
    application?.fullLegalName &&
    application.email &&
    application.phone &&
    application.countryOfResidence &&
    application.currentLocation &&
    application.dateOfBirth &&
    application.idIssuingCountry &&
    application.idNumberLast4,
  );
  const consentComplete =
    Boolean(application?.videoConsentAt && application.declarationAcceptedAt) &&
    application?.status !== "rejected" &&
    application?.status !== "changes_requested";
  const requirementState: Record<KycRequirementKey, boolean> = {
    personal: personalComplete,
    identity_document: identityUploaded,
    face_video: videoUploaded,
    consent: consentComplete,
  };

  return (
    <div className="space-y-8">
      {application ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">
            {t("account.kyc.statusLabel")}
          </span>
          <Badge tone={isApproved ? "success" : "neutral"}>
            {t(kycStatusLabelKey(application.status))}
          </Badge>
        </div>
      ) : null}

      {isDecided && application.decisionReason ? (
        <Notice tone={isApproved ? "success" : "info"}>
          <strong>{t("account.kyc.reasonLabel")}:</strong>{" "}
          {application.decisionReason}
        </Notice>
      ) : null}

      {state?.ok ? (
        <Notice tone="success">{t("account.kyc.submitted")}</Notice>
      ) : null}
      {draftState?.ok ? (
        <Notice tone="info">{t("account.kyc.draftSaved")}</Notice>
      ) : null}

      {errorState ? (
        <Notice tone="error">
          {errorState.error === "documents_missing" && errorState.fields?.form
            ? t("account.kyc.missingRequired", {
                items: errorState.fields.form
                  .split(",")
                  .map((requirement) =>
                    t(kycRequirementLabelKey(requirement as KycRequirementKey)),
                  )
                  .join(", "),
              })
            : t(`errors.${errorState.error}`)}
        </Notice>
      ) : null}

      <Card>
        <h2 className="text-lg font-semibold text-ink-900">
          {t("account.kyc.requirementsHeading")}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {t("account.kyc.requirementsIntro")}
        </p>
        <ol className="mt-4 border-t border-border">
          {KYC_REQUIREMENTS.map((requirement, index) => {
            const complete = requirementState[requirement];
            return (
              <li
                key={requirement}
                className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 border-b border-border py-3 last:border-0 sm:grid-cols-[2rem_minmax(0,1fr)_auto]"
              >
                <span className="font-mono text-xs text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">
                    {t(kycRequirementLabelKey(requirement))}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {t(kycRequirementBodyKey(requirement))}
                  </p>
                </div>
                <div className="col-start-2 sm:col-start-auto">
                  <Badge tone={complete ? "success" : "neutral"}>
                    {complete
                      ? t("account.kyc.requirementComplete")
                      : t("account.kyc.requirementIncomplete")}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <form id="kyc-form" action={submitAction} className="space-y-6">
        <Card>
          <h2 className="text-lg font-semibold text-ink-900">
            {t("account.kyc.sectionPersonal")}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextField
              id="fullLegalName"
              name="fullLegalName"
              label={t("account.kyc.fullLegalName")}
              defaultValue={application?.fullLegalName ?? ""}
              required
              error={fieldError("fullLegalName")}
            />
            <TextField
              id="email"
              name="email"
              type="email"
              label={t("account.kyc.email")}
              defaultValue={application?.email ?? ""}
              required
              error={fieldError("email")}
            />
            <TextField
              id="phone"
              name="phone"
              label={t("account.kyc.phone")}
              defaultValue={application?.phone ?? ""}
              required
              error={fieldError("phone")}
            />
            <TextField
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              label={t("account.kyc.dateOfBirth")}
              defaultValue={application?.dateOfBirth ?? ""}
              required
              error={fieldError("dateOfBirth")}
            />
            <TextField
              id="countryOfResidence"
              name="countryOfResidence"
              label={t("account.kyc.countryOfResidence")}
              defaultValue={application?.countryOfResidence ?? "Cameroon"}
              required
              error={fieldError("countryOfResidence")}
            />
            <TextField
              id="currentLocation"
              name="currentLocation"
              label={t("account.kyc.currentLocation")}
              defaultValue={application?.currentLocation ?? ""}
              required
              error={fieldError("currentLocation")}
            />
            <SelectField
              id="residencyStatus"
              name="residencyStatus"
              label={t("account.kyc.residencyStatusLabel")}
              defaultValue={application?.residencyStatus ?? "permanent"}
              required
              error={fieldError("residencyStatus")}
            >
              {KYC_RESIDENCY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(kycResidencyStatusLabelKey(status))}
                </option>
              ))}
            </SelectField>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-ink-900">
            {t("account.kyc.sectionIdentity")}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SelectField
              id="idType"
              name="idType"
              label={t("account.kyc.idTypeLabel")}
              defaultValue={application?.idType ?? "national_id_card"}
              required
              error={fieldError("idType")}
            >
              {KYC_ID_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(kycIdTypeLabelKey(type))}
                </option>
              ))}
            </SelectField>
            <TextField
              id="idIssuingCountry"
              name="idIssuingCountry"
              label={t("account.kyc.idIssuingCountry")}
              defaultValue={application?.idIssuingCountry ?? "Cameroon"}
              required
              error={fieldError("idIssuingCountry")}
            />
            <TextField
              id="idNumberLast4"
              name="idNumberLast4"
              label={t("account.kyc.idNumberLast4")}
              hint={t("account.kyc.idNumberLast4Hint")}
              maxLength={4}
              defaultValue={application?.idNumberLast4 ?? ""}
              required
              error={fieldError("idNumberLast4")}
            />
          </div>
        </Card>
      </form>

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-3">
          <DraftButton
            form="kyc-form"
            formAction={draftAction}
            label={t("account.kyc.saveDraft")}
            pendingLabel={t("account.kyc.savingDraft")}
            pending={savingDraft}
          />
          <p className="text-xs text-muted">
            {t("account.kyc.savePersonalFirst")}
          </p>
        </div>
      ) : null}

      <KycDocumentUpload
        membershipType={membershipType}
        documents={documents}
        locale={locale}
        readOnly={readOnly}
        applicationReady={application !== null}
      />

      {!readOnly ? (
        <Card>
          <h2 className="text-lg font-semibold text-ink-900">
            {t("account.kyc.sectionSubmit")}
          </h2>

          {!documentsReady ? (
            <Notice tone="info">
              {t("account.kyc.missingDocumentsBeforeSubmit")}
            </Notice>
          ) : null}

          {!consentOpen ? (
            <p className="mt-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConsentOpen(true)}
              >
                {application?.status === "rejected" ||
                application?.status === "changes_requested"
                  ? t("account.kyc.resubmit")
                  : t("account.kyc.submit")}
              </Button>
            </p>
          ) : null}

          <div className={consentOpen ? "mt-4 space-y-4" : "hidden"}>
            <ConsentRow
              form="kyc-form"
              id="videoConsent"
              label={t("account.kyc.videoConsent")}
              error={
                errorState?.fields?.videoConsent
                  ? t("errors.consent_required")
                  : undefined
              }
            />
            <ConsentRow
              form="kyc-form"
              id="declaration"
              label={t("account.kyc.declaration")}
              error={
                errorState?.fields?.declaration
                  ? t("errors.consent_required")
                  : undefined
              }
            />
            <p className="text-xs text-muted">{t("account.kyc.privacyNote")}</p>
            <SubmitButton
              form="kyc-form"
              label={t("account.kyc.submit")}
              pendingLabel={t("account.kyc.submitting")}
              pending={submitting}
              disabled={!documentsReady}
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function ConsentRow({
  form,
  id,
  label,
  error,
}: {
  form: string;
  id: string;
  label: string;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-start gap-2.5">
        <input
          form={form}
          id={id}
          name={id}
          type="checkbox"
          required
          aria-invalid={error ? true : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong"
        />
        <label htmlFor={id} className="text-sm text-body">
          {label}
        </label>
      </div>
      {error ? (
        <p className="mt-1 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SubmitButton({
  form,
  label,
  pendingLabel,
  pending,
  disabled,
}: {
  form: string;
  label: string;
  pendingLabel: string;
  pending: boolean;
  disabled: boolean;
}) {
  return (
    <Button
      type="submit"
      form={form}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}

function DraftButton({
  form,
  formAction,
  label,
  pendingLabel,
  pending,
}: {
  form: string;
  formAction: (formData: FormData) => void;
  label: string;
  pendingLabel: string;
  pending: boolean;
}) {
  return (
    <Button
      type="submit"
      form={form}
      formNoValidate
      variant="secondary"
      formAction={formAction}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
