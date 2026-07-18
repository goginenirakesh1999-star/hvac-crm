// Rocky Solutions LLC — site configuration.

// Web3Forms access key. Get a free key at https://web3forms.com using
// goginenirakesh1999@gmail.com, then paste it here. Reports are emailed to
// the address tied to this key.
export const WEB3FORMS_ACCESS_KEY = "REPLACE_WITH_WEB3FORMS_ACCESS_KEY";

export const CALENDLY_URL = "https://calendly.com/goginenirakesh1999/intro-call";
export const CONTACT_EMAIL = "goginenirakeshbabu99@gmail.com";
export const REPORT_EMAIL = "goginenirakesh1999@gmail.com";
export const COMPANY = "Rocky Solutions LLC";

// ⚠️ REQUIRED before submitting to banks / payment processors / A2P 10DLC.
// Replace these placeholders with your real registered business details.
export const BUSINESS_PHONE = "REPLACE_WITH_BUSINESS_PHONE"; // e.g. "+1 (555) 123-4567"
export const BUSINESS_ADDRESS = "REPLACE_WITH_REGISTERED_BUSINESS_ADDRESS"; // street, city, state, ZIP

// Public site URL (update if you move to a custom domain).
export const SITE_URL = "https://goginenirakesh1999-star.github.io/hvac-crm/";

// True when a config value has been filled in (not a REPLACE_ placeholder).
export const isSet = (v: string) => !v.startsWith("REPLACE_");
