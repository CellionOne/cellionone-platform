// Registered Office Service Limits Configuration
// These values can be overridden via environment variables

export const serviceLimits = {
  // Number of mail items included per month before overage charges apply
  mailItemsIncludedPerMonth: parseInt(
    process.env.REGISTERED_OFFICE_MAIL_ITEMS_INCLUDED_PER_MONTH || "5",
    10
  ),

  // Number of days mail is stored before being returned/shredded
  storageDays: parseInt(
    process.env.REGISTERED_OFFICE_STORAGE_DAYS || "30",
    10
  ),

  // If true, only official mail (government, bank, legal, commercial) is accepted
  // Personal mail and unknown senders require admin confirmation
  officialMailOnly: process.env.REGISTERED_OFFICE_OFFICIAL_MAIL_ONLY !== "false",

  // Policy text for display in UI
  getPolicyText() {
    return {
      title: "Service Policy",
      items: [
        {
          label: "Accepted Mail",
          value: this.officialMailOnly
            ? "Official business mail only (government, bank, legal, commercial). Personal mail and parcels are not accepted."
            : "All mail types accepted.",
        },
        {
          label: "Included Items",
          value: `${this.mailItemsIncludedPerMonth} mail items per month included. Additional items may incur extra charges.`,
        },
        {
          label: "Scanning & Notification",
          value: "All mail is scanned and you receive email notification. Physical forwarding available at additional cost.",
        },
        {
          label: "Storage Duration",
          value: `Mail is securely stored for ${this.storageDays} days. After this period, unclaimed mail will be returned to sender or securely disposed of.`,
        },
        {
          label: "After Storage Period",
          value: "Default: Return to sender. If undeliverable, secure shredding with certificate provided upon request.",
        },
      ],
    };
  },
};

export type ServiceLimitsPolicy = ReturnType<typeof serviceLimits.getPolicyText>;
