// Rocky Solutions LLC — site configuration.

// Formspree endpoint. Report submissions are emailed to the address this
// Formspree form is configured to deliver to (goginenirakesh1999@gmail.com).
export const FORMSPREE_ENDPOINT = "https://formspree.io/f/xqerkekp";

export const CALENDLY_URL = "https://calendly.com/goginenirakesh1999/intro-call";
export const CONTACT_EMAIL = "goginenirakeshbabu99@gmail.com";
export const REPORT_EMAIL = "goginenirakesh1999@gmail.com";
export const COMPANY = "Rocky Solutions LLC";

// Registered business details (shown to banks / payment processors / A2P reviewers).
export const BUSINESS_PHONE = "+91 90638 55903";
export const BUSINESS_ADDRESS = "728 Derby Way Dr, Wentzville, MO 63385";

// Public site URL (update if you move to a custom domain).
export const SITE_URL = "https://goginenirakesh1999-star.github.io/hvac-crm/";

// True when a config value has been filled in (not a REPLACE_ placeholder).
export const isSet = (v: string) => !v.startsWith("REPLACE_");
