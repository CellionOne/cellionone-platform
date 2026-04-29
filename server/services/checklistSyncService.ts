import { storage } from '../storage';
import { db } from '../db';
import { eq, inArray } from 'drizzle-orm';
import { verifiedEntities, identityVerifications, companyPeople, users } from '@shared/schema';

/**
 * Auto-resolve checklist items for a given application based on current verification state.
 * Called after founder or director identity verification completes.
 * Never downgrades items already accepted by an admin.
 */
export async function syncChecklistFromVerifications(applicationId: number, founderId: string): Promise<void> {
  try {
    const [checklistItems, founderProfile, idVerification, teamMembers] = await Promise.all([
      storage.getChecklistItems(applicationId),
      storage.getFounderProfile(founderId),
      storage.getIdentityVerification(founderId),
      storage.getCompanyPeople(applicationId),
    ]);

    async function autoProvide(key: string, autoNotes: string): Promise<void> {
      const item = checklistItems.find((i) => i.key === key);
      if (!item || item.status !== "missing" || item.isAutoResolved === true) return;
      await storage.updateChecklistItem(item.id, {
        status: "provided",
        reviewerNotes: autoNotes,
        isAutoResolved: true,
        source: "kyc_auto_resolved",
      });
    }

    if (founderProfile?.passportPhotoPath) {
      await autoProvide("passport_photo", "Auto-resolved: verified passport photo on file from identity verification");
    }

    const idVerified = idVerification?.bvnNinVerified === true;
    const hasIdDoc = !!founderProfile?.idDocumentPath;
    if (idVerified || hasIdDoc) {
      await autoProvide("id_document", "Auto-resolved: government ID confirmed via BVN/NIN verification");
    }

    const directors = teamMembers.filter((p) => p.role === "director" || p.role === "director_shareholder");
    const shareholders = teamMembers.filter((p) => p.role === "shareholder" || p.role === "director_shareholder");

    function isPersonVerified(person: typeof teamMembers[number]): boolean {
      if (person.entityType === "corporate") {
        return person.autoVerifyMethod !== null || person.kybLookupStatus === "found";
      }
      return person.isVerified === true;
    }

    const directorCheckReady =
      directors.length === 0
        ? idVerified || hasIdDoc
        : directors.every(isPersonVerified);

    if (directorCheckReady) {
      await autoProvide("director_id", "Auto-resolved: all directors are identity-verified on the platform");
    }

    const shareholderCheckReady =
      shareholders.length === 0
        ? idVerified || hasIdDoc
        : shareholders.every(isPersonVerified);

    if (shareholderCheckReady) {
      await autoProvide("shareholder_details", "Auto-resolved: all shareholders are identity-verified on the platform");
    }
  } catch (err) {
    console.error(`[ChecklistSync] Failed for application ${applicationId}:`, err);
  }
}

// Document sets per entity type/business type
type DocSlug = { slug: string; label: string };

function getDocSlugsForPerson(
  personId: number,
  displayName: string,
  entityType: string | null,
  bizType: string | null | undefined,
): DocSlug[] {
  const n = displayName;
  if (entityType === "corporate") {
    if (bizType === "bn") {
      return [
        { slug: "cac_cert_registration", label: `${n} — CAC Certificate of Registration` },
        { slug: "proprietor_gov_id", label: `${n} — Proprietor Government ID` },
        { slug: "proof_business_address", label: `${n} — Proof of Business Address` },
      ];
    }
    if (bizType === "it") {
      return [
        { slug: "cac_cert_incorporation_trustees", label: `${n} — CAC Certificate of Incorporation of Trustees` },
        { slug: "constitution_rules", label: `${n} — Constitution / Rules of the Association` },
        { slug: "list_of_trustees", label: `${n} — List of Trustees` },
        { slug: "board_resolution_minutes", label: `${n} — Board Resolution / Minutes Authorising the Registration` },
      ];
    }
    // Default to "co"
    return [
      { slug: "cac_cert_incorporation", label: `${n} — CAC Certificate of Incorporation` },
      { slug: "memorandum_articles", label: `${n} — Memorandum & Articles of Association` },
      { slug: "board_resolution", label: `${n} — Board Resolution (Authorising the Directorship/Shareholding)` },
      { slug: "list_of_directors", label: `${n} — List of Directors` },
    ];
  }
  // Individual
  return [
    { slug: "gov_id", label: `${n} — Government-Issued ID` },
    { slug: "passport_photo", label: `${n} — Passport Photograph` },
    { slug: "proof_of_address", label: `${n} — Proof of Address` },
  ];
}

// Any status that should be converted to auto-resolved when verification is confirmed
const UNRESOLVED_STATUSES = new Set(["missing", "rejected"]);

/**
 * Idempotently create/update/delete per-person document checklist items
 * (source = 'people_requirement') for every director/shareholder in the application.
 *
 * - Creates items for unverified parties that don't have them yet.
 * - Auto-resolves items (status → accepted) for parties that are verified,
 *   including items that are 'missing' or 'rejected'.
 * - Deletes items whose person has been removed from the application.
 * - Performs authoritative verification lookups against verified_entities (for
 *   corporate RC numbers) and identityVerifications (for individual users) so
 *   that items are resolved even if company_people flags are stale.
 *
 * Safe to call multiple times — fully idempotent (unique constraint on applicationId+key).
 */
export async function syncPeopleDocumentRequirements(applicationId: number): Promise<void> {
  try {
    const [people, allItems] = await Promise.all([
      storage.getCompanyPeople(applicationId),
      storage.getChecklistItems(applicationId),
    ]);

    const existingPeopleReqItems = allItems.filter(i => i.source === "people_requirement");

    // ── Authoritative lookup: batch-fetch verified_entities for corporate RC numbers ──
    const rcNumbers = people
      .filter(p => p.entityType === "corporate" && p.corporateRcNumber)
      .map(p => p.corporateRcNumber as string);

    const verifiedRcSet = new Set<string>();
    if (rcNumbers.length > 0) {
      const rows = await db
        .select({ rcNumber: verifiedEntities.rcNumber })
        .from(verifiedEntities)
        .where(inArray(verifiedEntities.rcNumber, rcNumbers));
      for (const row of rows) {
        if (row.rcNumber) verifiedRcSet.add(row.rcNumber);
      }
    }

    // ── Authoritative lookup: batch-fetch identityVerifications for individual users ──
    // Primary: by personUserId (already linked)
    const personUserIds = people
      .filter(p => p.entityType !== "corporate" && p.personUserId)
      .map(p => p.personUserId as string);

    // Secondary: for invite-only persons (inviteEmail but no personUserId), resolve email → userId
    const inviteEmails = people
      .filter(p => p.entityType !== "corporate" && !p.personUserId && p.inviteEmail)
      .map(p => p.inviteEmail as string);

    // Map inviteEmail → userId for email-based resolution
    const emailToUserId = new Map<string, string>();
    if (inviteEmails.length > 0) {
      const emailRows = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.email, inviteEmails));
      for (const row of emailRows) {
        if (row.email) emailToUserId.set(row.email, row.id);
      }
    }

    // Union all user IDs: directly linked + email-resolved
    const allIndividualUserIds = [
      ...personUserIds,
      ...Array.from(emailToUserId.values()),
    ];

    const verifiedIndividualSet = new Set<string>();
    if (allIndividualUserIds.length > 0) {
      const rows = await db
        .select({ founderUserId: identityVerifications.founderUserId, bvnNinVerified: identityVerifications.bvnNinVerified })
        .from(identityVerifications)
        .where(inArray(identityVerifications.founderUserId, allIndividualUserIds));
      for (const row of rows) {
        if (row.bvnNinVerified) verifiedIndividualSet.add(row.founderUserId);
      }
    }

    // Build the full set of expected item keys for current people
    const expectedKeys = new Set<string>();

    for (const person of people) {
      const displayName =
        person.entityType === "corporate"
          ? (person.corporateName ?? person.title ?? "Corporate Entity")
          : (person.title ?? person.inviteEmail ?? `Person ${person.id}`);

      const docSlugs = getDocSlugsForPerson(
        person.id,
        displayName,
        person.entityType ?? "individual",
        person.corporateBusinessType,
      );

      // Authoritative verification check:
      // Corporate: check verified_entities by RC number (in addition to stale company_people flags)
      // Individual: check identityVerifications by userId (in addition to stale isVerified flag)
      let verified: boolean;
      if (person.entityType === "corporate") {
        const rcVerified = !!(person.corporateRcNumber && verifiedRcSet.has(person.corporateRcNumber));
        verified = rcVerified || !!person.autoVerifyMethod || person.kybLookupStatus === "found";
      } else {
        // Check by linked userId first; fallback to email-resolved userId for invite-only persons
        const linkedUserId = person.personUserId
          ?? (person.inviteEmail ? emailToUserId.get(person.inviteEmail) : undefined);
        const idxVerified = !!(linkedUserId && verifiedIndividualSet.has(linkedUserId));
        verified = idxVerified || person.isVerified === true;
      }

      for (const { slug, label } of docSlugs) {
        const key = `people_req_${person.id}_${slug}`;
        expectedKeys.add(key);

        const existing = existingPeopleReqItems.find(i => i.key === key);

        if (!existing) {
          // onConflictDoNothing prevents duplicates under concurrent calls
          if (verified) {
            // source stays "people_requirement" (not "kyc_auto_resolved") so the
            // UI can keep the item in the "People & Entity Documents" group even
            // after auto-resolution. isAutoResolved=true + status="accepted" are
            // the authoritative auto-resolution markers for these items.
            await storage.createChecklistItem({
              applicationId,
              key,
              label,
              required: true,
              status: "accepted",
              isAutoResolved: true,
              source: "people_requirement",
              reviewerNotes: "Auto-resolved: identity/entity verified on the platform",
            });
          } else {
            await storage.createChecklistItem({
              applicationId,
              key,
              label,
              required: true,
              status: "missing",
              source: "people_requirement",
            });
          }
        } else {
          // Item exists — update label if name changed, auto-resolve if newly verified
          const updates: Record<string, unknown> = {};
          if (existing.label !== label) updates.label = label;
          // Resolve both 'missing' and 'rejected' statuses when the party is now verified
          if (verified && existing.status !== null && UNRESOLVED_STATUSES.has(existing.status)) {
            updates.status = "accepted";
            updates.isAutoResolved = true;
            updates.reviewerNotes = "Auto-resolved: identity/entity verified on the platform";
          }
          if (Object.keys(updates).length > 0) {
            await storage.updateChecklistItem(existing.id, updates as Parameters<typeof storage.updateChecklistItem>[1]);
          }
        }
      }
    }

    // Clean up orphaned items (person removed or business type changed)
    for (const item of existingPeopleReqItems) {
      if (item.key && !expectedKeys.has(item.key)) {
        await storage.deleteChecklistItem(item.id);
      }
    }
  } catch (err) {
    console.error(`[PeopleDocSync] Failed for application ${applicationId}:`, err);
  }
}

/**
 * When an individual user's identity is verified, mark their company_people
 * records as isVerified and sync checklist items for all their linked applications.
 *
 * Exported so webhook handlers (verificationWebhookHandler, paystackWebhookHandler)
 * can call it as well as the inline API routes.
 */
export async function syncAllApplicationsForVerifiedUser(userId: string): Promise<void> {
  try {
    const people = await storage.getCompanyPeopleByPersonUserId(userId);
    const appIds = new Set<number>();

    for (const person of people) {
      if (person.entityType === 'corporate') continue;
      // Mark person as verified if not already
      if (!person.isVerified) {
        await db.update(companyPeople)
          .set({ isVerified: true, updatedAt: new Date() })
          .where(eq(companyPeople.id, person.id));
      }
      if (person.applicationId && person.founderId) {
        await syncChecklistFromVerifications(person.applicationId, person.founderId);
        appIds.add(person.applicationId);
      }
    }

    for (const appId of appIds) {
      await syncPeopleDocumentRequirements(appId);
    }
  } catch (err) {
    console.error(`[ChecklistSync] syncAllApplicationsForVerifiedUser failed for user ${userId}:`, err);
  }
}
