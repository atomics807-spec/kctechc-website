"use client";

import {
  useActionState,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import {
  removeKycDocumentAction,
  uploadKycDocumentAction,
  type KycDocumentState,
} from "@/lib/real-estate/kyc-actions";
import {
  kycDocumentGuidanceKey,
  kycDocumentKindLabelKey,
  type KycDocumentKind,
  type KycDocumentRecord,
  type KycMembershipType,
} from "@/lib/real-estate/kyc";
import {
  exceedsSizeLimit,
  MAX_KYC_DOCUMENT_BYTES,
  MAX_KYC_VIDEO_BYTES,
} from "@/lib/uploads/limits";
import {
  ALLOWED_KYC_DOCUMENT_TYPES,
  ALLOWED_KYC_VIDEO_TYPES,
} from "@/lib/uploads/validation";

/**
 * KYC document and face-video uploader.
 *
 * Every document has its own named slot, in the order the reviewer expects them.
 * Choosing a file starts the upload immediately, so there is no separate Upload
 * button to press and no way to leave a chosen file sitting unsent. Each slot is
 * still its own multipart POST, because a face video must not be re-sent with a
 * later application edit.
 *
 * The accepted types and the size limit are read from the same constants the
 * server validates against, so the promise the UI makes and the rule the server
 * enforces cannot drift.
 */

type SlotStatus = "required" | "alternative" | "optional";

type SlotDefinition = {
  kind: KycDocumentKind;
  status: SlotStatus;
  hint?: string;
};

const IDENTITY_SLOTS: SlotDefinition[] = [
  {
    kind: "id_front",
    status: "alternative",
    hint: "account.kyc.identityDocumentsIntro",
  },
  {
    kind: "id_back",
    status: "optional",
    hint: "account.kyc.identityBackHint",
  },
  { kind: "passport", status: "alternative" },
];

const FACE_SLOTS: SlotDefinition[] = [
  { kind: "face_video", status: "required" },
];

const EXTRA_SLOTS: SlotDefinition[] = [
  { kind: "proof_of_address", status: "optional" },
  { kind: "other", status: "optional" },
];

export function KycDocumentUpload({
  membershipType,
  documents,
  locale,
  readOnly,
  applicationReady,
}: {
  membershipType: KycMembershipType;
  documents: KycDocumentRecord[];
  locale: Locale;
  readOnly: boolean;
  applicationReady: boolean;
}) {
  const t = createTranslator(locale).t;
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const byKind = new Map<KycDocumentKind, KycDocumentRecord>();
  for (const document of documents) {
    if (!byKind.has(document.kind)) byKind.set(document.kind, document);
  }

  function remove(documentId: string): void {
    setRemovingId(documentId);
    startTransition(async () => {
      await removeKycDocumentAction(documentId, locale);
      setRemovingId(null);
    });
  }

  return (
    <section aria-labelledby="kyc-documents-heading" className="space-y-5">
      <div>
        <h2
          id="kyc-documents-heading"
          className="text-lg font-semibold text-ink-900"
        >
          {t("account.kyc.requiredDocumentsHeading")}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {t("account.kyc.requiredDocumentsIntro")}
        </p>
      </div>

      {!applicationReady ? (
        <Notice tone="info">
          {t("account.kyc.applicationRequiredForUploads")}
        </Notice>
      ) : (
        <>
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">
                {t("account.kyc.identityDocumentsHeading")}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {t("account.kyc.identityDocumentsIntro")}
              </p>
            </div>
            {IDENTITY_SLOTS.map((slot) => (
              <DocumentSlot
                key={`${slot.kind}:${byKind.get(slot.kind)?.id ?? "new"}`}
                slot={slot}
                document={byKind.get(slot.kind)}
                membershipType={membershipType}
                locale={locale}
                readOnly={readOnly}
                removingId={removingId}
                onRemove={remove}
              />
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">
                {t("account.kyc.faceVideoHeading")}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {t(kycDocumentGuidanceKey("face_video"))}
              </p>
            </div>
            {FACE_SLOTS.map((slot) => (
              <DocumentSlot
                key={`${slot.kind}:${byKind.get(slot.kind)?.id ?? "new"}`}
                slot={slot}
                document={byKind.get(slot.kind)}
                membershipType={membershipType}
                locale={locale}
                readOnly={readOnly}
                removingId={removingId}
                onRemove={remove}
              />
            ))}
          </div>

          <details className="rounded-card border border-border bg-surface px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink-900">
              {t("account.kyc.additionalDocumentsHeading")}
            </summary>
            <p className="mt-2 text-sm text-muted">
              {t("account.kyc.additionalDocumentsIntro")}
            </p>
            <div className="mt-4 space-y-3">
              {EXTRA_SLOTS.map((slot) => (
                <DocumentSlot
                  key={`${slot.kind}:${byKind.get(slot.kind)?.id ?? "new"}`}
                  slot={slot}
                  document={byKind.get(slot.kind)}
                  membershipType={membershipType}
                  locale={locale}
                  readOnly={readOnly}
                  removingId={removingId}
                  onRemove={remove}
                />
              ))}
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function DocumentSlot({
  slot,
  document,
  membershipType,
  locale,
  readOnly,
  removingId,
  onRemove,
}: {
  slot: SlotDefinition;
  document: KycDocumentRecord | undefined;
  membershipType: KycMembershipType;
  locale: Locale;
  readOnly: boolean;
  removingId: string | null;
  onRemove: (documentId: string) => void;
}) {
  const t = createTranslator(locale).t;
  const [state, formAction, pending] = useActionState(
    uploadKycDocumentAction.bind(null, membershipType, locale),
    null as KycDocumentState | null,
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const isVideo = slot.kind === "face_video";
  const limit = isVideo ? MAX_KYC_VIDEO_BYTES : MAX_KYC_DOCUMENT_BYTES;
  const accept = (
    isVideo ? ALLOWED_KYC_VIDEO_TYPES : ALLOWED_KYC_DOCUMENT_TYPES
  ).join(",");
  const label = t(kycDocumentKindLabelKey(slot.kind));
  const guidance = t(kycDocumentGuidanceKey(slot.kind));
  const status =
    slot.status === "required"
      ? t("account.kyc.documentSlotRequired")
      : slot.status === "alternative"
        ? t("account.kyc.documentSlotAlternative")
        : t("account.kyc.documentSlotOptional");

  function onFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (exceedsSizeLimit(file, limit)) {
      setClientError("too_large");
      event.target.value = "";
      return;
    }
    setClientError(null);
    formRef.current?.requestSubmit();
  }

  if (document) {
    return (
      <div className="grid gap-3 rounded-card border border-border bg-surface-alt px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink-900">{label}</p>
            <Badge tone="success">
              {t("account.kyc.documentSlotUploaded")}
            </Badge>
          </div>
          <p className="mt-1 truncate text-sm text-body">
            {document.originalFilename}
          </p>
        </div>
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={removingId === document.id}
            onClick={() => onRemove(document.id)}
          >
            {removingId === document.id
              ? t("account.kyc.removing")
              : t("account.kyc.remove")}
          </Button>
        ) : null}
      </div>
    );
  }

  if (readOnly) return null;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-card border border-border bg-surface px-4 py-3"
    >
      <input type="hidden" name="kind" value={slot.kind} />
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-ink-900">{label}</p>
        <Badge tone={slot.status === "required" ? "warning" : "neutral"}>
          {status}
        </Badge>
      </div>
      {slot.hint ? (
        <p className="mt-1 text-xs text-muted">{t(slot.hint)}</p>
      ) : null}
      <p className="mt-1 text-xs text-muted">{guidance}</p>

      {state && !state.ok ? (
        <div className="mt-2">
          <Notice tone="error">{t(`errors.${state.error}`)}</Notice>
        </div>
      ) : null}
      {clientError ? (
        <div className="mt-2">
          <Notice tone="error">{t("errors.too_large")}</Notice>
        </div>
      ) : null}

      <label className="mt-3 block text-sm font-medium text-ink-900">
        {t("account.kyc.chooseFileFor", { item: label })}
        <input
          type="file"
          name="file"
          accept={accept}
          required
          disabled={pending}
          onChange={onFileChange}
          className="mt-1.5 block w-full rounded-field border border-border-strong bg-surface px-3 py-2 text-sm text-ink-900 file:mr-3 file:rounded-control file:border-0 file:bg-ink-950 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white disabled:opacity-60"
        />
      </label>
      <p className="mt-1 text-xs text-muted" aria-live="polite">
        {pending ? t("account.kyc.uploading") : t("account.kyc.autoUploadHint")}
      </p>
    </form>
  );
}
