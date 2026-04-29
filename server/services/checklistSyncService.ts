import { storage } from '../storage';

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
