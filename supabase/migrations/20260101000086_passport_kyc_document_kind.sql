-- Add the passport photo page as an accepted KYC identity document.
--
-- The application already offers `international_passport` as an ID *type*, but the
-- upload vocabulary had no passport kind, so a passport holder had to file the
-- photo page under "Identity document — front". That metadata is what the reviewer
-- sees, so the mismatch made a valid submission look mislabelled.
--
-- `id_front` remains valid for a national ID card; a passport is a single page and
-- needs no `id_back`. The application-side requirement accepts either.

alter type public.kyc_document_kind add value if not exists 'passport' before 'face_video';

comment on type public.kyc_document_kind is
  'What a stored KYC file is. `passport` is the photo page of an international passport, which satisfies the identity requirement instead of `id_front`. `face_video` is a manual liveness recording, reviewed by a person; no facial-recognition processing is performed.';
