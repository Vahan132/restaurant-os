/**
 * Legal content model + source text for the Privacy Policy and Terms &
 * Conditions pages (/legal/privacy, /legal/terms).
 *
 * IMPORTANT: This is ORIGINAL DRAFT content written for Restaurant OS. It has
 * NOT been reviewed by a lawyer and is not legal advice. Square-bracketed
 * tokens like [LEGAL ENTITY NAME] are PLACEHOLDERS for the company to fill in;
 * the page renderer highlights them so they are impossible to miss in review.
 *
 * Content is authored in English first. The Armenian (hy) and Russian (ru)
 * versions are intentionally left as stubs to be translated and reviewed — for
 * Armenian users the ARMENIAN version is the controlling language and must be
 * reviewed by an Armenian lawyer before launch.
 *
 * Inline text supports a tiny markup subset (see components/legal/inline.tsx):
 *   **bold**            → emphasised text
 *   [label](/path)      → link (internal or external)
 *   [PLACEHOLDER TEXT]   → highlighted placeholder chip
 */

import type { Locale } from "./i18n";

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "sub"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "callout"; tone?: "note" | "tip" | "warning"; title?: string; text: string };

export type LegalSection = {
  /** Stable anchor id, also used by the table of contents. */
  id: string;
  title: string;
  blocks: LegalBlock[];
};

export type LegalDoc = {
  title: string;
  /** Short standfirst shown under the title. */
  intro: string;
  sections: LegalSection[];
};

export type LegalDocKey = "privacy" | "terms";

/** Single source of truth for the "Last updated" date shown on both pages. */
export const legalLastUpdated = { iso: "2026-06-03", display: "3 June 2026" } as const;

/* ============================================================================
   PRIVACY POLICY — English (controlling for now; hy/ru to be translated)
   ========================================================================== */

const privacyEn: LegalDoc = {
  title: "Privacy Policy",
  intro:
    "How [LEGAL ENTITY NAME] collects, uses and protects personal data in connection with the Restaurant OS platform and this website.",
  sections: [
    {
      id: "about",
      title: "1. Who we are",
      blocks: [
        {
          type: "p",
          text: "Restaurant OS is a business-to-business software platform provided by **[LEGAL ENTITY NAME]**, registration number **[REGISTRATION No.]**, registered in **Yerevan, Republic of Armenia** (the **\"Company\"**, **\"we\"**, **\"us\"**). This Privacy Policy explains how we handle personal data when you visit our website, create or manage an account, communicate with us, or when a subscribing restaurant uses the platform.",
        },
        {
          type: "p",
          text: "For any privacy question or to exercise your rights, contact us at **[DPO/PRIVACY EMAIL]**. General enquiries can be sent to **[EMAIL]**.",
        },
        {
          type: "p",
          text: "We process personal data in accordance with the Republic of Armenia Law **\"On Protection of Personal Data\" (2015)** and related regulations. The supervisory authority is the **Personal Data Protection Agency (PDPA)** of the Ministry of Justice of the Republic of Armenia, with which you may file a complaint (see [Contact and complaints](#contact)).",
        },
      ],
    },
    {
      id: "roles",
      title: "2. Our roles: controller and processor",
      blocks: [
        {
          type: "p",
          text: "Because Restaurant OS serves both the businesses that subscribe and the people whose data those businesses handle, our role under data-protection law depends on the data in question.",
        },
        {
          type: "sub",
          text: "Where we are the controller",
        },
        {
          type: "p",
          text: "We act as the **controller** — deciding why and how data is processed — for:",
        },
        {
          type: "list",
          items: [
            "visitors to this website;",
            "the account, owner and billing-contact data of the restaurants that subscribe (for example the name, email and login details of the person who opens and manages the account); and",
            "support and other communications you send us directly.",
          ],
        },
        {
          type: "sub",
          text: "Where we are the processor (authorized person)",
        },
        {
          type: "p",
          text: "For the operational data that a subscribing restaurant enters into or generates through the platform, the **restaurant is the controller** and we act as a **processor** (the \"authorized person\" under Armenian law), processing that data only on the restaurant's behalf and on its instructions. This operational data includes, for example:",
        },
        {
          type: "list",
          items: [
            "the restaurant's **staff user** accounts (admin, point-of-sale and kitchen-display users); and",
            "the restaurant's **end-customers' data**, such as the names, phone numbers and email addresses captured through reservations and QR-menu ordering.",
          ],
        },
        {
          type: "callout",
          tone: "note",
          title: "What this means for end-customers",
          text: "If you are a guest of a restaurant that uses Restaurant OS, the restaurant — not the Company — decides how your data is used. Please direct requests about that data to the restaurant. We will support the restaurant in responding. Our processing of operational data is governed by these terms and, where applicable, a **data-processing addendum (DPA)** with the restaurant.",
        },
      ],
    },
    {
      id: "data-we-collect",
      title: "3. Personal data we collect",
      blocks: [
        {
          type: "sub",
          text: "Data you give us",
        },
        {
          type: "list",
          items: [
            "**Account and owner data** — name, business name, email address and password (stored only in hashed form) when you sign up or are invited.",
            "**Billing-contact data** — billing name, contact details and subscription/plan information. Card payments are handled by our payment provider; we do not store full card numbers.",
            "**Support and communications** — the content of messages, requests and feedback you send us.",
          ],
        },
        {
          type: "sub",
          text: "Data we collect automatically",
        },
        {
          type: "list",
          items: [
            "**Usage and device data** — IP address, browser and device type, pages viewed and approximate location, collected to operate and secure the website and platform.",
            "**Cookies and similar technologies** — see [Cookies and website analytics](#cookies).",
          ],
        },
        {
          type: "sub",
          text: "Operational data processed on a restaurant's behalf",
        },
        {
          type: "p",
          text: "When a restaurant uses the platform, we process the data it enters or generates — menus, orders, tables and reservations, staff users, and end-customer details such as reservation and QR-order names, phone numbers and email addresses. As explained in [Our roles](#roles), we process this data as a **processor** on the restaurant's instructions.",
        },
        {
          type: "callout",
          tone: "note",
          text: "We do not seek to collect special categories of data (such as health or biometric data) and ask that restaurants do not enter such data into free-text fields.",
        },
      ],
    },
    {
      id: "purposes",
      title: "4. How and why we use data",
      blocks: [
        {
          type: "p",
          text: "Where we are the controller, we use personal data to:",
        },
        {
          type: "list",
          items: [
            "create and administer accounts and issue platform login credentials;",
            "provide, maintain, secure and improve the website and the platform;",
            "manage free trials, subscriptions, billing and renewals;",
            "respond to support requests and communicate about the service, including important changes;",
            "detect, prevent and investigate fraud, abuse and security incidents; and",
            "comply with our legal, accounting and tax obligations.",
          ],
        },
        {
          type: "p",
          text: "Where we are a **processor**, we use operational data only to provide the platform to the restaurant and as instructed by it — never for our own independent marketing.",
        },
      ],
    },
    {
      id: "lawful-bases",
      title: "5. Lawful bases for processing",
      blocks: [
        {
          type: "p",
          text: "We rely on one or more of the following lawful bases under Armenian data-protection law:",
        },
        {
          type: "list",
          items: [
            "**Consent** — given freely, specifically, on an informed basis and unambiguously, including by electronic means (for example, opting in to non-essential cookies or marketing). You may withdraw consent at any time (see [Your rights and choices](#rights)).",
            "**Performance of a contract** — processing necessary to provide the service you or your business has signed up for, including issuing credentials and handling billing.",
            "**Legal obligation** — processing required to meet our accounting, tax and other legal duties.",
            "**Legitimate operational interests** — keeping the platform secure and preventing abuse, balanced against your rights.",
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "6. Cookies and website analytics",
      blocks: [
        {
          type: "p",
          text: "Our website uses cookies and similar technologies that are **strictly necessary** to make it work (for example, to keep you signed in and to remember preferences). With your consent, we may also use **analytics** cookies to understand how the site is used so we can improve it.",
        },
        {
          type: "p",
          text: "You can manage non-essential cookies through the consent controls provided on the site and through your browser settings. Disabling some cookies may affect how the site functions. **[Confirm the exact analytics provider(s) used — e.g. a privacy-friendly, self-hosted tool — and list them here.]**",
        },
      ],
    },
    {
      id: "sharing",
      title: "7. Sharing, sub-processors and hosting",
      blocks: [
        {
          type: "p",
          text: "We do not sell personal data. We share it only as needed to run the service:",
        },
        {
          type: "list",
          items: [
            "**Service providers / sub-processors** — vetted vendors that host our infrastructure and provide cloud, email, payment and analytics services, acting on our instructions under appropriate agreements. **[Maintain a current list of sub-processors here, including hosting/cloud provider(s).]**",
            "**Professional advisers and authorities** — where required by law, court order, or to protect our rights, users and the public.",
            "**Business transfers** — if the Company is involved in a merger, acquisition or asset sale, data may be transferred subject to this Policy.",
          ],
        },
      ],
    },
    {
      id: "transfers",
      title: "8. International data transfers",
      blocks: [
        {
          type: "p",
          text: "Our hosting and some sub-processors may store or process data **outside the Republic of Armenia**. Armenian law does not impose strict data localization, but cross-border transfers are subject to safeguards. Where data is transferred to a country that does not provide an adequate level of protection, we obtain the **approval of the Personal Data Protection Agency (PDPA)** where required and put appropriate contractual and technical safeguards in place.",
        },
        {
          type: "callout",
          tone: "warning",
          text: "**[Confirm the hosting region(s) and the specific transfer mechanism / PDPA approvals relied upon, and update this section accordingly.]**",
        },
      ],
    },
    {
      id: "retention",
      title: "9. How long we keep data",
      blocks: [
        {
          type: "p",
          text: "We keep personal data only for as long as needed for the purposes above:",
        },
        {
          type: "list",
          items: [
            "**Account and operational data** — for the life of the subscription. After termination, data is retained for a short wind-down period to allow export, then deleted or anonymised. **[Specify the wind-down / export window, e.g. 30 days.]**",
            "**Billing and tax records** — for the period required by Armenian accounting and tax law. **[Confirm retention period with your accountant.]**",
            "**Website and analytics data** — for a limited period consistent with the purpose for which it was collected.",
          ],
        },
        {
          type: "p",
          text: "When we act as a processor, we retain operational data according to the restaurant's instructions and the applicable data-processing addendum.",
        },
      ],
    },
    {
      id: "security",
      title: "10. Security and data breaches",
      blocks: [
        {
          type: "p",
          text: "We apply appropriate technical and organisational measures to protect personal data, including encryption in transit, access controls, hashed password storage, and the principle of least privilege for staff access. No system is perfectly secure, so we cannot guarantee absolute security.",
        },
        {
          type: "p",
          text: "If a personal-data breach occurs that is likely to affect your rights, we will act to contain it and will notify affected parties and, where required, the **PDPA**, in line with Armenian law. Where we act as a processor, we will notify the relevant restaurant (the controller) without undue delay so it can meet its own obligations.",
        },
      ],
    },
    {
      id: "rights",
      title: "11. Your rights and choices",
      blocks: [
        {
          type: "p",
          text: "Subject to the conditions in Armenian data-protection law, you have the right to:",
        },
        {
          type: "list",
          items: [
            "**access** the personal data we hold about you and learn how it is processed;",
            "request **rectification** of inaccurate or incomplete data;",
            "request **erasure** (deletion) of your data where the law allows;",
            "**object to** or request that we restrict certain processing; and",
            "**withdraw consent** at any time, without affecting processing already carried out on that basis.",
          ],
        },
        {
          type: "p",
          text: "To exercise any of these rights, contact **[DPO/PRIVACY EMAIL]**. We may need to verify your identity and will respond within the timeframe required by law. If your data was entered into the platform by a restaurant, we are a **processor** for that data — please contact the restaurant directly, and we will assist it in responding.",
        },
      ],
    },
    {
      id: "children",
      title: "12. Children's data",
      blocks: [
        {
          type: "p",
          text: "Restaurant OS is a business tool and is **not directed at children**. We do not knowingly collect personal data from children. If you believe a child has provided us with data, contact **[DPO/PRIVACY EMAIL]** and we will take appropriate steps to delete it.",
        },
      ],
    },
    {
      id: "changes",
      title: "13. Changes to this policy",
      blocks: [
        {
          type: "p",
          text: "We may update this Policy from time to time. We will revise the \"Last updated\" date above and, for material changes, provide additional notice (for example by email or an in-product notice). Your continued use of the website or platform after an update takes effect means you accept the revised Policy.",
        },
      ],
    },
    {
      id: "contact",
      title: "14. Contact and complaints",
      blocks: [
        {
          type: "p",
          text: "For privacy questions or to exercise your rights, contact **[LEGAL ENTITY NAME]** at **[DPO/PRIVACY EMAIL]** (privacy) or **[EMAIL]** (general). Postal address: **[REGISTERED ADDRESS, YEREVAN, ARMENIA]**.",
        },
        {
          type: "p",
          text: "If you believe your data has been handled unlawfully, you may lodge a complaint with the **Personal Data Protection Agency (PDPA)** of the Ministry of Justice of the Republic of Armenia.",
        },
      ],
    },
  ],
};

/* ============================================================================
   TERMS & CONDITIONS — English (controlling for now; hy/ru to be translated)
   ========================================================================== */

const termsEn: LegalDoc = {
  title: "Terms & Conditions",
  intro:
    "The agreement between [LEGAL ENTITY NAME] and the businesses that subscribe to the Restaurant OS platform.",
  sections: [
    {
      id: "acceptance",
      title: "1. Acceptance and eligibility",
      blocks: [
        {
          type: "p",
          text: "These Terms & Conditions (the **\"Terms\"**) form a binding agreement between **[LEGAL ENTITY NAME]**, registration number **[REGISTRATION No.]**, registered in **Yerevan, Republic of Armenia** (the **\"Company\"**, **\"we\"**, **\"us\"**), and the business that subscribes to Restaurant OS (the **\"Customer\"**, **\"you\"**).",
        },
        {
          type: "p",
          text: "By creating an account, starting a free trial, or using the platform, you accept these Terms. Restaurant OS is offered **for business use only**; by accepting you confirm that you are acting on behalf of a business and that the person accepting has authority to bind it. If you do not agree, do not use the platform.",
        },
      ],
    },
    {
      id: "service",
      title: "2. The service and your credentials",
      blocks: [
        {
          type: "p",
          text: "Restaurant OS is a cloud platform for running a restaurant, which may include an **admin dashboard**, **point-of-sale (POS)**, **kitchen display (KDS)**, **tables & reservations**, and a **customer-facing QR menu and ordering** experience, together with the features described on our website for your plan.",
        },
        {
          type: "p",
          text: "On sign-up we issue the Customer **login credentials** for the relevant components. You are responsible for distributing access appropriately within your business and for keeping credentials confidential (see [Your account and responsibilities](#account)).",
        },
      ],
    },
    {
      id: "account",
      title: "3. Your account, credentials and responsibilities",
      blocks: [
        {
          type: "list",
          items: [
            "You must keep account credentials **secure and confidential** and notify us promptly of any suspected unauthorised access.",
            "You are responsible for all activity under your account, including the actions of your **staff users**, and for ensuring they are authorised and comply with these Terms.",
            "You are responsible for your own **content** — including menus, descriptions, prices, images and tax settings — and for its accuracy and legality.",
            "You are responsible for your **end-customers' data** that you collect through the platform and for handling it lawfully as its controller (see [Data protection](#data-processing)).",
            "You remain solely responsible for your own **legal, tax and fiscal obligations**.",
          ],
        },
        {
          type: "callout",
          tone: "warning",
          title: "The platform does not handle your taxes or fiscal receipts",
          text: "Restaurant OS is operational software. It does **not** file your taxes, calculate your tax liability, or issue legally compliant fiscal receipts on your behalf. Meeting fiscal-device, receipt and tax requirements under Armenian law remains entirely your responsibility. **[Confirm fiscal/receipt scope with your accountant and legal adviser.]**",
        },
      ],
    },
    {
      id: "trial-billing",
      title: "4. Free trial, subscriptions and billing",
      blocks: [
        {
          type: "sub",
          text: "7-day free trial",
        },
        {
          type: "p",
          text: "New Customers may start a **7-day free trial**. You may **cancel at any time before the trial ends to avoid any charge**. If you do not cancel before the trial ends, your subscription begins and the applicable fees become payable.",
        },
        {
          type: "sub",
          text: "Subscriptions, renewal and price changes",
        },
        {
          type: "list",
          items: [
            "Subscriptions are offered on the **plans** and at the prices shown on our website or in your order, billed in advance for each billing period.",
            "Subscriptions **renew automatically** for successive periods unless cancelled before the renewal date.",
            "We may change prices or plans for future billing periods and will give **reasonable advance notice**. Continued use after a change takes effect means you accept the new price.",
          ],
        },
        {
          type: "callout",
          tone: "warning",
          title: "Fees are non-refundable after the free trial",
          text: "Once the free trial ends, **subscription fees are non-refundable**, including for partial periods or unused time, except where a refund is required by applicable Armenian law. To avoid being charged, cancel **before** the free trial ends.",
        },
        {
          type: "p",
          text: "Prices may be **subject to value-added tax (VAT)** or other applicable taxes under Armenian law, which may be added to the amounts shown. **[Confirm VAT treatment and invoicing requirements with your accountant.]**",
        },
      ],
    },
    {
      id: "custom",
      title: "5. Custom and unique features",
      blocks: [
        {
          type: "p",
          text: "On request, we may offer **custom or unique features** beyond your standard plan. Any such work is provided only under a **separate scope, fee and written agreement**; we are under no obligation to build custom work unless and until we agree it in writing.",
        },
        {
          type: "p",
          text: "Unless the separate agreement says otherwise, **intellectual property in custom work remains with the Company**, and you receive a licence to use it as part of the service. **[Specify IP ownership and licensing terms for custom work in the separate agreement.]**",
        },
      ],
    },
    {
      id: "acceptable-use",
      title: "6. Acceptable use and restrictions",
      blocks: [
        {
          type: "p",
          text: "You agree not to, and not to permit your users to:",
        },
        {
          type: "list",
          items: [
            "use the platform unlawfully, or to store or transmit unlawful, infringing or harmful content;",
            "attempt to gain unauthorised access to, disrupt, or compromise the platform or its security;",
            "reverse engineer, copy, resell or sublicense the platform except as permitted by law;",
            "use the platform to send unsolicited messages or to process data without a lawful basis; or",
            "interfere with other customers' use of the service.",
          ],
        },
      ],
    },
    {
      id: "data-processing",
      title: "7. Data protection and processing",
      blocks: [
        {
          type: "p",
          text: "Our handling of personal data is described in our [Privacy Policy](/legal/privacy). For the operational data you enter into the platform — including your staff users and your end-customers' data — **you are the controller and we act as your processor**, processing it on your instructions to provide the service.",
        },
        {
          type: "p",
          text: "Where required, this processing is governed by a **data-processing addendum (DPA)**, which forms part of these Terms. You are responsible for having a lawful basis to collect and use that data and for honouring your end-customers' rights. **[Attach or link the DPA.]**",
        },
      ],
    },
    {
      id: "availability",
      title: "8. Availability, maintenance and beta features",
      blocks: [
        {
          type: "p",
          text: "We work to keep the platform available and reliable, but we do not guarantee uninterrupted or error-free operation. We may perform **maintenance** and may need to suspend parts of the service temporarily, aiming to minimise disruption and to give notice of planned downtime where practical.",
        },
        {
          type: "p",
          text: "We may offer **beta or preview features** that are clearly identified as such. These are provided \"as is\", may change or be withdrawn, and should not be relied upon for critical operations.",
        },
      ],
    },
    {
      id: "warranties",
      title: "9. Service provided \"as is\"",
      blocks: [
        {
          type: "p",
          text: "To the maximum extent permitted by Armenian law, the platform is provided **\"as is\" and \"as available\"**, without warranties of any kind, whether express or implied, including fitness for a particular purpose and non-infringement. We do not warrant that the platform will meet every requirement of your business.",
        },
      ],
    },
    {
      id: "liability",
      title: "10. Limitation of liability",
      blocks: [
        {
          type: "p",
          text: "To the extent permitted by Armenian law, the Company is not liable for indirect, incidental or consequential losses, or for lost profits, revenue, goodwill or data. **[Specify the aggregate liability cap — e.g. the fees paid in the preceding 12 months.]**",
        },
        {
          type: "callout",
          tone: "note",
          text: "Nothing in these Terms excludes or limits liability that cannot be excluded or limited under the law of the Republic of Armenia.",
        },
      ],
    },
    {
      id: "suspension",
      title: "11. Suspension and termination",
      blocks: [
        {
          type: "p",
          text: "You may cancel your subscription at any time, effective at the end of the current billing period (subject to the non-refund rule in [Free trial, subscriptions and billing](#trial-billing)).",
        },
        {
          type: "p",
          text: "We may **suspend or terminate** access where you breach these Terms, including for **non-payment**. Suspension for non-payment or breach **blocks access to the platform** until the issue is resolved. We will give notice where reasonable and practical.",
        },
        {
          type: "sub",
          text: "Effect of termination",
        },
        {
          type: "p",
          text: "On termination, your right to use the platform ends. We will make your data available for **export** for a limited period, after which it is **deleted or anonymised** in line with our [Privacy Policy](/legal/privacy). **[Confirm the export window and deletion timeline.]**",
        },
      ],
    },
    {
      id: "ip",
      title: "12. Intellectual property and confidentiality",
      blocks: [
        {
          type: "p",
          text: "The platform, its software, design and brand are owned by the Company and its licensors; nothing in these Terms transfers that intellectual property to you beyond the limited right to use the service. **Your data and content remain yours** — you grant us only the licence needed to host and process them to provide the service.",
        },
        {
          type: "p",
          text: "Each party will keep the other's non-public information confidential and use it only as needed to perform these Terms, except where disclosure is required by law.",
        },
      ],
    },
    {
      id: "governing-law",
      title: "13. Governing law and disputes",
      blocks: [
        {
          type: "p",
          text: "These Terms are governed by the law of the **Republic of Armenia**. The parties will first attempt to resolve any dispute in good faith. Failing that, disputes are subject to the **courts of the Republic of Armenia (Yerevan)**. **[Or specify arbitration — e.g. a named arbitration body, seat and rules — if preferred.]**",
        },
      ],
    },
    {
      id: "changes",
      title: "14. Changes to these terms",
      blocks: [
        {
          type: "p",
          text: "We may update these Terms from time to time. We will revise the \"Last updated\" date above and give **reasonable notice** of material changes (for example by email or an in-product notice). Continued use of the platform after a change takes effect means you accept the updated Terms.",
        },
      ],
    },
    {
      id: "contact",
      title: "15. Contact",
      blocks: [
        {
          type: "p",
          text: "Questions about these Terms can be sent to **[LEGAL ENTITY NAME]** at **[EMAIL]**. Registered address: **[REGISTERED ADDRESS, YEREVAN, ARMENIA]**.",
        },
      ],
    },
  ],
};

/* ============================================================================
   PRIVACY POLICY — Armenian (hy) — DRAFT translation, pending lawyer review
   ========================================================================== */

const privacyHy: LegalDoc = {
  title: "Գաղտնիության քաղաքականություն",
  intro:
    "Թե ինչպես է **[LEGAL ENTITY NAME]**-ը հավաքում, օգտագործում և պաշտպանում անձնական տվյալները Restaurant OS հարթակի և սույն կայքի հետ կապված։",
  sections: [
    {
      id: "about",
      title: "1. Ովքեր ենք մենք",
      blocks: [
        {
          type: "p",
          text: "Restaurant OS-ը բիզնեսից բիզնես ծրագրային հարթակ է, որը տրամադրում է **[LEGAL ENTITY NAME]**-ը, գրանցման համարը՝ **[REGISTRATION No.]**, գրանցված է **Yerevan, Republic of Armenia**-ում (**«Ընկերություն»**, **«մենք»**, **«մեզ»**)։ Սույն Գաղտնիության քաղաքականությունը բացատրում է, թե ինչպես ենք մենք վերաբերվում անձնական տվյալներին, երբ դուք այցելում եք մեր կայք, ստեղծում կամ կառավարում եք հաշիվ, շփվում եք մեզ հետ, կամ երբ բաժանորդագրված ռեստորանն օգտագործում է հարթակը։",
        },
        {
          type: "p",
          text: "Գաղտնիության հետ կապված ցանկացած հարցով կամ ձեր իրավունքներն իրացնելու համար կապվեք մեզ հետ՝ **[DPO/PRIVACY EMAIL]** հասցեով։ Ընդհանուր հարցումները կարող եք ուղարկել **[EMAIL]** հասցեով։",
        },
        {
          type: "p",
          text: "Մենք մշակում ենք անձնական տվյալները Հայաստանի Հանրապետության **«Անձնական տվյալների պաշտպանության մասին» (2015)** օրենքին և հարակից կարգավորումներին համապատասխան։ Վերահսկող մարմինը Հայաստանի Հանրապետության արդարադատության նախարարության **Personal Data Protection Agency (PDPA)**-ն է, որին կարող եք բողոք ներկայացնել (տես [Կապ և բողոքներ](#contact))։",
        },
      ],
    },
    {
      id: "roles",
      title: "2. Մեր դերերը՝ վերահսկող և մշակող",
      blocks: [
        {
          type: "p",
          text: "Քանի որ Restaurant OS-ը սպասարկում է թե՛ բաժանորդագրվող բիզնեսներին, թե՛ այն մարդկանց, ում տվյալները մշակում են այդ բիզնեսները, տվյալների պաշտպանության օրենսդրության համաձայն մեր դերը կախված է տվյալ տվյալներից։",
        },
        {
          type: "sub",
          text: "Երբ մենք վերահսկողն ենք",
        },
        {
          type: "p",
          text: "Մենք հանդես ենք գալիս որպես **վերահսկող** — որոշելով, թե ինչու և ինչպես են մշակվում տվյալները — հետևյալի համար՝",
        },
        {
          type: "list",
          items: [
            "սույն կայքի այցելուներ․",
            "բաժանորդագրվող ռեստորանների հաշվի, սեփականատիրոջ և վճարման կոնտակտի տվյալներ (օրինակ՝ հաշիվը բացող և կառավարող անձի անունը, էլ․ փոստը և մուտքի տվյալները)․ և",
            "աջակցության և այլ հաղորդակցություններ, որ դուք ուղղակիորեն ուղարկում եք մեզ։",
          ],
        },
        {
          type: "sub",
          text: "Երբ մենք մշակողն ենք (լիազորված անձ)",
        },
        {
          type: "p",
          text: "Այն գործառնական տվյալների համար, որ բաժանորդագրվող ռեստորանը մուտքագրում է հարթակ կամ ստեղծում է դրա միջոցով, **ռեստորանը վերահսկողն է**, իսկ մենք հանդես ենք գալիս որպես **մշակող** (հայկական օրենսդրությամբ՝ «լիազորված անձ»), մշակելով այդ տվյալները միայն ռեստորանի անունից և նրա հրահանգներով։ Այս գործառնական տվյալները ներառում են, օրինակ՝",
        },
        {
          type: "list",
          items: [
            "ռեստորանի **աշխատակից օգտատերերի** հաշիվները (ադմինիստրատորի, POS-ի և KDS-ի օգտատերեր)․ և",
            "ռեստորանի **վերջնական հաճախորդների տվյալները**, ինչպիսիք են ամրագրումների և QR-ճաշացանկով պատվերների միջոցով հավաքված անունները, հեռախոսահամարները և էլ․ փոստի հասցեները։",
          ],
        },
        {
          type: "callout",
          tone: "note",
          title: "Ի՞նչ է սա նշանակում վերջնական հաճախորդների համար",
          text: "Եթե դուք Restaurant OS-ն օգտագործող ռեստորանի հյուր եք, ապա ռեստորանը, ոչ թե Ընկերությունը, որոշում է, թե ինչպես է օգտագործվում ձեր տվյալները։ Խնդրում ենք այդ տվյալների վերաբերյալ հարցումներն ուղղել ռեստորանին։ Մենք կաջակցենք ռեստորանին պատասխանելու հարցում։ Գործառնական տվյալների մեր մշակումը կարգավորվում է սույն պայմաններով և, կիրառելի դեպքերում, ռեստորանի հետ կնքված **տվյալների մշակման հավելվածով (DPA)**։",
        },
      ],
    },
    {
      id: "data-we-collect",
      title: "3. Անձնական տվյալներ, որ մենք հավաքում ենք",
      blocks: [
        {
          type: "sub",
          text: "Տվյալներ, որ դուք տրամադրում եք մեզ",
        },
        {
          type: "list",
          items: [
            "**Հաշվի և սեփականատիրոջ տվյալներ** — անունը, բիզնեսի անվանումը, էլ․ փոստի հասցեն և գաղտնաբառը (պահվում է միայն հեշավորված ձևով), երբ դուք գրանցվում եք կամ հրավիրվում եք։",
            "**Վճարման կոնտակտի տվյալներ** — վճարման անունը, կոնտակտային տվյալները և բաժանորդագրության/պլանի մասին տեղեկությունները։ Քարտով վճարումները կատարվում են մեր վճարային մատակարարի կողմից․ մենք չենք պահում քարտի ամբողջական համարները։",
            "**Աջակցություն և հաղորդակցություններ** — ձեր ուղարկած հաղորդագրությունների, հարցումների և արձագանքների բովանդակությունը։",
          ],
        },
        {
          type: "sub",
          text: "Տվյալներ, որ մենք հավաքում ենք ինքնաշխատ կերպով",
        },
        {
          type: "list",
          items: [
            "**Օգտագործման և սարքի տվյալներ** — IP հասցե, դիտարկիչի և սարքի տեսակ, դիտված էջեր և մոտավոր գտնվելու վայր, որ հավաքվում են կայքն ու հարթակը գործարկելու և անվտանգ պահելու համար։",
            "**Cookie-ներ և համանման տեխնոլոգիաներ** — տես [Cookie-ներ և կայքի վերլուծություն](#cookies)։",
          ],
        },
        {
          type: "sub",
          text: "Ռեստորանի անունից մշակվող գործառնական տվյալներ",
        },
        {
          type: "p",
          text: "Երբ ռեստորանն օգտագործում է հարթակը, մենք մշակում ենք նրա մուտքագրած կամ ստեղծած տվյալները՝ ճաշացանկեր, պատվերներ, սեղաններ և ամրագրումներ, աշխատակից օգտատերեր և վերջնական հաճախորդների տվյալներ, ինչպիսիք են ամրագրման ու QR-պատվերի անունները, հեռախոսահամարները և էլ․ փոստի հասցեները։ Ինչպես բացատրված է [Մեր դերերը](#roles) բաժնում, մենք մշակում ենք այս տվյալները որպես **մշակող**՝ ռեստորանի հրահանգներով։",
        },
        {
          type: "callout",
          tone: "note",
          text: "Մենք չենք ձգտում հավաքել տվյալների հատուկ կատեգորիաներ (օրինակ՝ առողջության կամ կենսաչափական տվյալներ) և խնդրում ենք ռեստորաններին չմուտքագրել նման տվյալներ ազատ տեքստի դաշտերում։",
        },
      ],
    },
    {
      id: "purposes",
      title: "4. Ինչպես և ինչու ենք մենք օգտագործում տվյալները",
      blocks: [
        {
          type: "p",
          text: "Երբ մենք վերահսկողն ենք, մենք օգտագործում ենք անձնական տվյալները՝",
        },
        {
          type: "list",
          items: [
            "հաշիվներ ստեղծելու և կառավարելու և հարթակ մուտք գործելու տվյալներ տրամադրելու համար․",
            "կայքն ու հարթակը տրամադրելու, պահպանելու, անվտանգ պահելու և բարելավելու համար․",
            "անվճար փորձաշրջանները, բաժանորդագրությունները, վճարումները և երկարաձգումները կառավարելու համար․",
            "աջակցության հարցումներին պատասխանելու և ծառայության, այդ թվում՝ կարևոր փոփոխությունների մասին հաղորդակցվելու համար․",
            "խարդախությունը, չարաշահումը և անվտանգության միջադեպերը հայտնաբերելու, կանխելու և քննելու համար․ և",
            "մեր իրավական, հաշվապահական և հարկային պարտավորությունները կատարելու համար։",
          ],
        },
        {
          type: "p",
          text: "Երբ մենք **մշակող** ենք, մենք օգտագործում ենք գործառնական տվյալները միայն ռեստորանին հարթակը տրամադրելու և նրա հրահանգների համաձայն՝ երբեք մեր սեփական անկախ մարքեթինգի համար։",
        },
      ],
    },
    {
      id: "lawful-bases",
      title: "5. Մշակման իրավական հիմքերը",
      blocks: [
        {
          type: "p",
          text: "Մենք հիմնվում ենք հայկական տվյալների պաշտպանության օրենսդրությամբ նախատեսված հետևյալ իրավական հիմքերից մեկի կամ մի քանիսի վրա՝",
        },
        {
          type: "list",
          items: [
            "**Համաձայնություն** — տրված ազատ, կոնկրետ, տեղեկացված և միանշանակ կերպով, այդ թվում՝ էլեկտրոնային միջոցներով (օրինակ՝ ոչ պարտադիր cookie-ների կամ մարքեթինգի համար համաձայնություն տալով)։ Դուք կարող եք ցանկացած պահի հետ կանչել ձեր համաձայնությունը (տես [Ձեր իրավունքները և ընտրությունները](#rights))։",
            "**Պայմանագրի կատարում** — մշակում, որ անհրաժեշտ է ձեզ կամ ձեր բիզնեսին տրամադրվող ծառայությունը մատուցելու համար, այդ թվում՝ մուտքի տվյալներ տրամադրելու և վճարումները կառավարելու համար։",
            "**Իրավական պարտավորություն** — մշակում, որ պահանջվում է մեր հաշվապահական, հարկային և այլ իրավական պարտականությունները կատարելու համար։",
            "**Օրինական գործառնական շահեր** — հարթակն անվտանգ պահելը և չարաշահումը կանխելը՝ հավասարակշռված ձեր իրավունքների հետ։",
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "6. Cookie-ներ և կայքի վերլուծություն",
      blocks: [
        {
          type: "p",
          text: "Մեր կայքն օգտագործում է cookie-ներ և համանման տեխնոլոգիաներ, որոնք **խստորեն անհրաժեշտ** են դրա աշխատանքի համար (օրինակ՝ ձեզ համակարգում մուտքագրված պահելու և նախապատվությունները հիշելու համար)։ Ձեր համաձայնությամբ մենք կարող ենք օգտագործել նաև **վերլուծական** cookie-ներ՝ հասկանալու համար, թե ինչպես է օգտագործվում կայքը, որպեսզի կարողանանք բարելավել այն։",
        },
        {
          type: "p",
          text: "Դուք կարող եք կառավարել ոչ պարտադիր cookie-ները կայքում տրամադրված համաձայնության կարգավորումների և ձեր դիտարկիչի կարգավորումների միջոցով։ Որոշ cookie-ների անջատումը կարող է ազդել կայքի աշխատանքի վրա։ **[Confirm the exact analytics provider(s) used — e.g. a privacy-friendly, self-hosted tool — and list them here.]**",
        },
      ],
    },
    {
      id: "sharing",
      title: "7. Փոխանցում, ենթամշակողներ և հոստինգ",
      blocks: [
        {
          type: "p",
          text: "Մենք չենք վաճառում անձնական տվյալներ։ Մենք դրանք փոխանցում ենք միայն այնքանով, որքանով անհրաժեշտ է ծառայությունը գործարկելու համար՝",
        },
        {
          type: "list",
          items: [
            "**Ծառայություններ մատուցողներ / ենթամշակողներ** — ստուգված մատակարարներ, որոնք հոստինգ են տրամադրում մեր ենթակառուցվածքին և մատուցում են ամպային, էլ․ փոստի, վճարային և վերլուծական ծառայություններ՝ գործելով մեր հրահանգներով՝ համապատասխան համաձայնագրերի ներքո։ **[Maintain a current list of sub-processors here, including hosting/cloud provider(s).]**",
            "**Մասնագիտական խորհրդատուներ և իշխանություններ** — երբ պահանջվում է օրենքով, դատարանի որոշմամբ, կամ մեր իրավունքները, օգտատերերին և հանրությունը պաշտպանելու համար։",
            "**Բիզնեսի փոխանցումներ** — եթե Ընկերությունը ներգրավվում է միաձուլման, ձեռքբերման կամ ակտիվների վաճառքի մեջ, տվյալները կարող են փոխանցվել՝ սույն Քաղաքականությանը համապատասխան։",
          ],
        },
      ],
    },
    {
      id: "transfers",
      title: "8. Տվյալների միջազգային փոխանցումներ",
      blocks: [
        {
          type: "p",
          text: "Մեր հոստինգը և որոշ ենթամշակողներ կարող են պահել կամ մշակել տվյալները **Հայաստանի Հանրապետությունից դուրս**։ Հայկական օրենսդրությունը խիստ տվյալների տեղայնացում չի պարտադրում, սակայն անդրսահմանային փոխանցումները ենթակա են պաշտպանական միջոցների։ Երբ տվյալները փոխանցվում են պաշտպանության համարժեք մակարդակ չապահովող երկիր, մենք անհրաժեշտության դեպքում ստանում ենք **Personal Data Protection Agency (PDPA)**-ի **հաստատումը** և կիրառում ենք համապատասխան պայմանագրային ու տեխնիկական պաշտպանական միջոցներ։",
        },
        {
          type: "callout",
          tone: "warning",
          text: "**[Confirm the hosting region(s) and the specific transfer mechanism / PDPA approvals relied upon, and update this section accordingly.]**",
        },
      ],
    },
    {
      id: "retention",
      title: "9. Որքա՞ն ժամանակ ենք մենք պահում տվյալները",
      blocks: [
        {
          type: "p",
          text: "Մենք պահում ենք անձնական տվյալները միայն այնքան ժամանակ, որքան անհրաժեշտ է վերը նշված նպատակների համար՝",
        },
        {
          type: "list",
          items: [
            "**Հաշվի և գործառնական տվյալներ** — բաժանորդագրության գործողության ողջ ընթացքում։ Դադարեցումից հետո տվյալները պահվում են կարճ ավարտական ժամանակահատվածում՝ արտահանումը հնարավոր դարձնելու համար, ապա ջնջվում կամ անանունացվում են։ **[Specify the wind-down / export window, e.g. 30 days.]**",
            "**Վճարման և հարկային գրառումներ** — հայկական հաշվապահական և հարկային օրենսդրությամբ պահանջվող ժամանակահատվածում։ **[Confirm retention period with your accountant.]**",
            "**Կայքի և վերլուծական տվյալներ** — սահմանափակ ժամանակահատվածում՝ համապատասխան այն նպատակին, որի համար դրանք հավաքվել են։",
          ],
        },
        {
          type: "p",
          text: "Երբ մենք հանդես ենք գալիս որպես մշակող, մենք պահում ենք գործառնական տվյալները ռեստորանի հրահանգների և կիրառելի տվյալների մշակման հավելվածի համաձայն։",
        },
      ],
    },
    {
      id: "security",
      title: "10. Անվտանգություն և տվյալների խախտումներ",
      blocks: [
        {
          type: "p",
          text: "Մենք կիրառում ենք համապատասխան տեխնիկական և կազմակերպչական միջոցներ՝ անձնական տվյալները պաշտպանելու համար, այդ թվում՝ փոխանցման ընթացքում գաղտնագրում, մուտքի վերահսկում, գաղտնաբառերի հեշավորված պահպանում և աշխատակիցների մուտքի համար նվազագույն արտոնության սկզբունք։ Ոչ մի համակարգ կատարյալ անվտանգ չէ, ուստի մենք չենք կարող երաշխավորել բացարձակ անվտանգություն։",
        },
        {
          type: "p",
          text: "Եթե տեղի ունենա անձնական տվյալների խախտում, որը հավանաբար կազդի ձեր իրավունքների վրա, մենք կգործենք այն զսպելու ուղղությամբ և կտեղեկացնենք տուժած կողմերին, իսկ անհրաժեշտության դեպքում՝ **PDPA**-ին՝ հայկական օրենսդրությանը համապատասխան։ Երբ մենք հանդես ենք գալիս որպես մշակող, մենք առանց անհարկի ձգձգման կտեղեկացնենք համապատասխան ռեստորանին (վերահսկողին), որպեսզի այն կարողանա կատարել իր սեփական պարտավորությունները։",
        },
      ],
    },
    {
      id: "rights",
      title: "11. Ձեր իրավունքները և ընտրությունները",
      blocks: [
        {
          type: "p",
          text: "Հայկական տվյալների պաշտպանության օրենսդրությամբ սահմանված պայմանների պահպանմամբ՝ դուք իրավունք ունեք՝",
        },
        {
          type: "list",
          items: [
            "**մուտք գործել** ձեր մասին մեր մոտ պահվող անձնական տվյալներին և իմանալ, թե ինչպես են դրանք մշակվում․",
            "պահանջել ոչ ճշգրիտ կամ թերի տվյալների **ուղղում**․",
            "պահանջել ձեր տվյալների **ջնջում**, երբ օրենքը դա թույլ է տալիս․",
            "**առարկել** կամ պահանջել, որ մենք սահմանափակենք որոշակի մշակում․ և",
            "ցանկացած պահի **հետ կանչել համաձայնությունը**՝ առանց ազդելու այդ հիմքով արդեն իրականացված մշակման վրա։",
          ],
        },
        {
          type: "p",
          text: "Այս իրավունքներից որևէ մեկն իրացնելու համար կապվեք **[DPO/PRIVACY EMAIL]** հասցեով։ Մենք կարող ենք անհրաժեշտ համարել ստուգել ձեր ինքնությունը և կպատասխանենք օրենքով պահանջվող ժամկետում։ Եթե ձեր տվյալները հարթակ են մուտքագրվել ռեստորանի կողմից, ապա մենք այդ տվյալների համար **մշակող** ենք. խնդրում ենք ուղղակիորեն կապվել ռեստորանի հետ, և մենք կաջակցենք նրան պատասխանելու հարցում։",
        },
      ],
    },
    {
      id: "children",
      title: "12. Երեխաների տվյալներ",
      blocks: [
        {
          type: "p",
          text: "Restaurant OS-ը բիզնես գործիք է և **ուղղված չէ երեխաներին**։ Մենք գիտակցաբար չենք հավաքում երեխաների անձնական տվյալներ։ Եթե կարծում եք, որ երեխան մեզ տրամադրել է տվյալներ, կապվեք **[DPO/PRIVACY EMAIL]** հասցեով, և մենք համապատասխան քայլեր կձեռնարկենք դրանք ջնջելու համար։",
        },
      ],
    },
    {
      id: "changes",
      title: "13. Սույն քաղաքականության փոփոխությունները",
      blocks: [
        {
          type: "p",
          text: "Մենք կարող ենք ժամանակ առ ժամանակ թարմացնել սույն Քաղաքականությունը։ Մենք կվերանայենք վերևի «Վերջին թարմացում» ամսաթիվը և էական փոփոխությունների դեպքում կտրամադրենք լրացուցիչ ծանուցում (օրինակ՝ էլ․ փոստով կամ ապրանքի ներսում ծանուցմամբ)։ Թարմացման ուժի մեջ մտնելուց հետո կայքի կամ հարթակի ձեր շարունակական օգտագործումը նշանակում է, որ դուք ընդունում եք վերանայված Քաղաքականությունը։",
        },
      ],
    },
    {
      id: "contact",
      title: "14. Կապ և բողոքներ",
      blocks: [
        {
          type: "p",
          text: "Գաղտնիության հարցերով կամ ձեր իրավունքներն իրացնելու համար կապվեք **[LEGAL ENTITY NAME]**-ի հետ **[DPO/PRIVACY EMAIL]** (գաղտնիություն) կամ **[EMAIL]** (ընդհանուր) հասցեով։ Փոստային հասցե՝ **[REGISTERED ADDRESS, YEREVAN, ARMENIA]**։",
        },
        {
          type: "p",
          text: "Եթե կարծում եք, որ ձեր տվյալները մշակվել են ապօրինի կերպով, դուք կարող եք բողոք ներկայացնել Հայաստանի Հանրապետության արդարադատության նախարարության **Personal Data Protection Agency (PDPA)**-ին։",
        },
      ],
    },
  ],
};

/* ============================================================================
   PRIVACY POLICY — Russian (ru) — DRAFT translation, pending lawyer review
   ========================================================================== */

const privacyRu: LegalDoc = {
  title: "Политика конфиденциальности",
  intro:
    "Как **[LEGAL ENTITY NAME]** собирает, использует и защищает персональные данные в связи с платформой Restaurant OS и настоящим веб-сайтом.",
  sections: [
    {
      id: "about",
      title: "1. Кто мы",
      blocks: [
        {
          type: "p",
          text: "Restaurant OS — это программная платформа формата «бизнес для бизнеса», предоставляемая **[LEGAL ENTITY NAME]**, регистрационный номер **[REGISTRATION No.]**, зарегистрированной в **Yerevan, Republic of Armenia** (**«Компания»**, **«мы»**, **«нас»**). Настоящая Политика конфиденциальности объясняет, как мы обрабатываем персональные данные, когда вы посещаете наш веб-сайт, создаёте или управляете учётной записью, общаетесь с нами, или когда подписавшийся ресторан использует платформу.",
        },
        {
          type: "p",
          text: "По любым вопросам конфиденциальности или для реализации ваших прав свяжитесь с нами по адресу **[DPO/PRIVACY EMAIL]**. Общие запросы можно направлять по адресу **[EMAIL]**.",
        },
        {
          type: "p",
          text: "Мы обрабатываем персональные данные в соответствии с Законом Республики Армения **«О защите персональных данных» (2015)** и связанными с ним нормативными актами. Надзорным органом является **Personal Data Protection Agency (PDPA)** Министерства юстиции Республики Армения, в который вы можете подать жалобу (см. [Контакты и жалобы](#contact)).",
        },
      ],
    },
    {
      id: "roles",
      title: "2. Наши роли: контролёр и обработчик",
      blocks: [
        {
          type: "p",
          text: "Поскольку Restaurant OS обслуживает как предприятия, которые оформляют подписку, так и лиц, чьи данные эти предприятия обрабатывают, наша роль согласно законодательству о защите данных зависит от рассматриваемых данных.",
        },
        {
          type: "sub",
          text: "Когда мы являемся контролёром",
        },
        {
          type: "p",
          text: "Мы выступаем в роли **контролёра** — определяя, зачем и как обрабатываются данные — в отношении:",
        },
        {
          type: "list",
          items: [
            "посетителей настоящего веб-сайта;",
            "данных учётной записи, владельца и контактного лица по оплате ресторанов, оформивших подписку (например, имени, адреса электронной почты и учётных данных лица, которое открывает и управляет учётной записью); и",
            "обращений в службу поддержки и иных сообщений, которые вы направляете нам напрямую.",
          ],
        },
        {
          type: "sub",
          text: "Когда мы являемся обработчиком (уполномоченным лицом)",
        },
        {
          type: "p",
          text: "В отношении операционных данных, которые подписавшийся ресторан вводит в платформу или формирует через неё, **контролёром является ресторан**, а мы выступаем в роли **обработчика** («уполномоченного лица» согласно армянскому законодательству), обрабатывая эти данные только от имени ресторана и по его указаниям. К таким операционным данным относятся, например:",
        },
        {
          type: "list",
          items: [
            "учётные записи **пользователей-сотрудников** ресторана (пользователи администрирования, POS и KDS); и",
            "**данные конечных клиентов** ресторана, такие как имена, номера телефонов и адреса электронной почты, собранные через бронирования и заказы через QR-меню.",
          ],
        },
        {
          type: "callout",
          tone: "note",
          title: "Что это означает для конечных клиентов",
          text: "Если вы являетесь гостем ресторана, использующего Restaurant OS, то именно ресторан, а не Компания, определяет, как используются ваши данные. Пожалуйста, направляйте запросы относительно этих данных в ресторан. Мы будем оказывать ресторану поддержку при ответе. Наша обработка операционных данных регулируется настоящими условиями и, где применимо, **дополнительным соглашением об обработке данных (DPA)** с рестораном.",
        },
      ],
    },
    {
      id: "data-we-collect",
      title: "3. Персональные данные, которые мы собираем",
      blocks: [
        {
          type: "sub",
          text: "Данные, которые вы нам предоставляете",
        },
        {
          type: "list",
          items: [
            "**Данные учётной записи и владельца** — имя, название предприятия, адрес электронной почты и пароль (хранится только в хешированном виде), когда вы регистрируетесь или вас приглашают.",
            "**Контактные данные для выставления счетов** — платёжное имя, контактные данные и сведения о подписке/тарифном плане. Платежи по картам обрабатываются нашим платёжным провайдером; мы не храним полные номера карт.",
            "**Поддержка и сообщения** — содержание сообщений, запросов и отзывов, которые вы нам направляете.",
          ],
        },
        {
          type: "sub",
          text: "Данные, которые мы собираем автоматически",
        },
        {
          type: "list",
          items: [
            "**Данные об использовании и устройстве** — IP-адрес, тип браузера и устройства, просмотренные страницы и приблизительное местоположение, собираемые для работы и обеспечения безопасности веб-сайта и платформы.",
            "**Cookie-файлы и аналогичные технологии** — см. [Cookie-файлы и аналитика веб-сайта](#cookies).",
          ],
        },
        {
          type: "sub",
          text: "Операционные данные, обрабатываемые от имени ресторана",
        },
        {
          type: "p",
          text: "Когда ресторан использует платформу, мы обрабатываем данные, которые он вводит или формирует — меню, заказы, столы и бронирования, пользователей-сотрудников и сведения о конечных клиентах, такие как имена, номера телефонов и адреса электронной почты при бронировании и QR-заказах. Как объяснено в разделе [Наши роли](#roles), мы обрабатываем эти данные в роли **обработчика** по указаниям ресторана.",
        },
        {
          type: "callout",
          tone: "note",
          text: "Мы не стремимся собирать специальные категории данных (такие как данные о здоровье или биометрические данные) и просим рестораны не вводить такие данные в поля свободного текста.",
        },
      ],
    },
    {
      id: "purposes",
      title: "4. Как и зачем мы используем данные",
      blocks: [
        {
          type: "p",
          text: "Когда мы являемся контролёром, мы используем персональные данные для того, чтобы:",
        },
        {
          type: "list",
          items: [
            "создавать и администрировать учётные записи и выдавать учётные данные для входа в платформу;",
            "предоставлять, поддерживать, обеспечивать безопасность и улучшать веб-сайт и платформу;",
            "управлять бесплатными пробными периодами, подписками, выставлением счетов и продлениями;",
            "отвечать на запросы в службу поддержки и сообщать о сервисе, в том числе о важных изменениях;",
            "выявлять, предотвращать и расследовать мошенничество, злоупотребления и инциденты безопасности; и",
            "выполнять наши правовые, бухгалтерские и налоговые обязательства.",
          ],
        },
        {
          type: "p",
          text: "Когда мы являемся **обработчиком**, мы используем операционные данные только для предоставления платформы ресторану и по его указаниям — никогда для нашего собственного независимого маркетинга.",
        },
      ],
    },
    {
      id: "lawful-bases",
      title: "5. Правовые основания обработки",
      blocks: [
        {
          type: "p",
          text: "Мы опираемся на одно или несколько из следующих правовых оснований согласно армянскому законодательству о защите данных:",
        },
        {
          type: "list",
          items: [
            "**Согласие** — данное свободно, конкретно, осознанно и однозначно, в том числе электронными средствами (например, при согласии на необязательные cookie-файлы или маркетинг). Вы можете отозвать согласие в любое время (см. [Ваши права и выбор](#rights)).",
            "**Исполнение договора** — обработка, необходимая для предоставления сервиса, на который подписались вы или ваше предприятие, включая выдачу учётных данных и обработку платежей.",
            "**Правовое обязательство** — обработка, необходимая для выполнения наших бухгалтерских, налоговых и иных правовых обязанностей.",
            "**Законные операционные интересы** — обеспечение безопасности платформы и предотвращение злоупотреблений, в балансе с вашими правами.",
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "6. Cookie-файлы и аналитика веб-сайта",
      blocks: [
        {
          type: "p",
          text: "Наш веб-сайт использует cookie-файлы и аналогичные технологии, которые **строго необходимы** для его работы (например, чтобы сохранять вашу авторизацию и запоминать предпочтения). С вашего согласия мы также можем использовать **аналитические** cookie-файлы, чтобы понимать, как используется сайт, и улучшать его.",
        },
        {
          type: "p",
          text: "Вы можете управлять необязательными cookie-файлами через средства управления согласием, предоставленные на сайте, и через настройки вашего браузера. Отключение некоторых cookie-файлов может повлиять на работу сайта. **[Confirm the exact analytics provider(s) used — e.g. a privacy-friendly, self-hosted tool — and list them here.]**",
        },
      ],
    },
    {
      id: "sharing",
      title: "7. Передача, субобработчики и хостинг",
      blocks: [
        {
          type: "p",
          text: "Мы не продаём персональные данные. Мы передаём их только в той мере, в какой это необходимо для работы сервиса:",
        },
        {
          type: "list",
          items: [
            "**Поставщики услуг / субобработчики** — проверенные подрядчики, которые размещают нашу инфраструктуру и предоставляют облачные, почтовые, платёжные и аналитические услуги, действуя по нашим указаниям на основании соответствующих соглашений. **[Maintain a current list of sub-processors here, including hosting/cloud provider(s).]**",
            "**Профессиональные консультанты и органы власти** — когда это требуется по закону, по решению суда, или для защиты наших прав, пользователей и общества.",
            "**Передача бизнеса** — если Компания участвует в слиянии, приобретении или продаже активов, данные могут быть переданы с соблюдением настоящей Политики.",
          ],
        },
      ],
    },
    {
      id: "transfers",
      title: "8. Международная передача данных",
      blocks: [
        {
          type: "p",
          text: "Наш хостинг и некоторые субобработчики могут хранить или обрабатывать данные **за пределами Республики Армения**. Армянское законодательство не предусматривает строгой локализации данных, однако трансграничная передача подлежит мерам защиты. Когда данные передаются в страну, не обеспечивающую достаточный уровень защиты, мы при необходимости получаем **одобрение Personal Data Protection Agency (PDPA)** и применяем соответствующие договорные и технические меры защиты.",
        },
        {
          type: "callout",
          tone: "warning",
          text: "**[Confirm the hosting region(s) and the specific transfer mechanism / PDPA approvals relied upon, and update this section accordingly.]**",
        },
      ],
    },
    {
      id: "retention",
      title: "9. Как долго мы храним данные",
      blocks: [
        {
          type: "p",
          text: "Мы храним персональные данные только в течение времени, необходимого для вышеуказанных целей:",
        },
        {
          type: "list",
          items: [
            "**Данные учётной записи и операционные данные** — в течение всего срока действия подписки. После прекращения данные сохраняются в течение короткого завершающего периода для возможности экспорта, после чего удаляются или анонимизируются. **[Specify the wind-down / export window, e.g. 30 days.]**",
            "**Платёжные и налоговые записи** — в течение периода, требуемого армянским бухгалтерским и налоговым законодательством. **[Confirm retention period with your accountant.]**",
            "**Данные веб-сайта и аналитики** — в течение ограниченного периода, соответствующего цели, для которой они были собраны.",
          ],
        },
        {
          type: "p",
          text: "Когда мы выступаем в роли обработчика, мы храним операционные данные согласно указаниям ресторана и применимому дополнительному соглашению об обработке данных.",
        },
      ],
    },
    {
      id: "security",
      title: "10. Безопасность и нарушения данных",
      blocks: [
        {
          type: "p",
          text: "Мы применяем соответствующие технические и организационные меры для защиты персональных данных, включая шифрование при передаче, контроль доступа, хранение паролей в хешированном виде и принцип наименьших привилегий для доступа сотрудников. Ни одна система не является идеально безопасной, поэтому мы не можем гарантировать абсолютную безопасность.",
        },
        {
          type: "p",
          text: "Если произойдёт нарушение персональных данных, которое, вероятно, затронет ваши права, мы примем меры по его сдерживанию и уведомим затронутые стороны, а при необходимости — **PDPA**, в соответствии с армянским законодательством. Когда мы выступаем в роли обработчика, мы без неоправданной задержки уведомим соответствующий ресторан (контролёра), чтобы он мог выполнить свои собственные обязательства.",
        },
      ],
    },
    {
      id: "rights",
      title: "11. Ваши права и выбор",
      blocks: [
        {
          type: "p",
          text: "С учётом условий, предусмотренных армянским законодательством о защите данных, вы имеете право:",
        },
        {
          type: "list",
          items: [
            "получить **доступ** к персональным данным, которые мы храним о вас, и узнать, как они обрабатываются;",
            "потребовать **исправления** неточных или неполных данных;",
            "потребовать **удаления** ваших данных, когда это допускает закон;",
            "**возражать против** определённой обработки или потребовать её ограничения; и",
            "**отозвать согласие** в любое время, без ущерба для обработки, уже выполненной на этом основании.",
          ],
        },
        {
          type: "p",
          text: "Для реализации любого из этих прав свяжитесь с **[DPO/PRIVACY EMAIL]**. Нам может потребоваться подтвердить вашу личность, и мы ответим в срок, требуемый законом. Если ваши данные были введены в платформу рестораном, мы являемся **обработчиком** этих данных — пожалуйста, свяжитесь с рестораном напрямую, а мы окажем ему содействие при ответе.",
        },
      ],
    },
    {
      id: "children",
      title: "12. Данные детей",
      blocks: [
        {
          type: "p",
          text: "Restaurant OS — это бизнес-инструмент, и он **не предназначен для детей**. Мы сознательно не собираем персональные данные детей. Если вы полагаете, что ребёнок предоставил нам данные, свяжитесь с **[DPO/PRIVACY EMAIL]**, и мы предпримем соответствующие шаги для их удаления.",
        },
      ],
    },
    {
      id: "changes",
      title: "13. Изменения настоящей политики",
      blocks: [
        {
          type: "p",
          text: "Мы можем время от времени обновлять настоящую Политику. Мы изменим указанную выше дату «Последнее обновление», а при существенных изменениях предоставим дополнительное уведомление (например, по электронной почте или уведомлением в продукте). Продолжение использования веб-сайта или платформы после вступления обновления в силу означает, что вы принимаете изменённую Политику.",
        },
      ],
    },
    {
      id: "contact",
      title: "14. Контакты и жалобы",
      blocks: [
        {
          type: "p",
          text: "По вопросам конфиденциальности или для реализации ваших прав свяжитесь с **[LEGAL ENTITY NAME]** по адресу **[DPO/PRIVACY EMAIL]** (конфиденциальность) или **[EMAIL]** (общие вопросы). Почтовый адрес: **[REGISTERED ADDRESS, YEREVAN, ARMENIA]**.",
        },
        {
          type: "p",
          text: "Если вы полагаете, что ваши данные были обработаны незаконно, вы можете подать жалобу в **Personal Data Protection Agency (PDPA)** Министерства юстиции Республики Армения.",
        },
      ],
    },
  ],
};

/* ============================================================================
   TERMS & CONDITIONS — Armenian (hy) — DRAFT translation, pending lawyer review
   ========================================================================== */

const termsHy: LegalDoc = {
  title: "Պայմաններ և դրույթներ",
  intro:
    "Համաձայնագիր **[LEGAL ENTITY NAME]**-ի և Restaurant OS հարթակին բաժանորդագրվող բիզնեսների միջև։",
  sections: [
    {
      id: "acceptance",
      title: "1. Ընդունում և իրավասություն",
      blocks: [
        {
          type: "p",
          text: "Սույն Պայմանները և դրույթները (**«Պայմաններ»**) կազմում են պարտադիր համաձայնագիր **[LEGAL ENTITY NAME]**-ի, գրանցման համարը՝ **[REGISTRATION No.]**, գրանցված է **Yerevan, Republic of Armenia**-ում (**«Ընկերություն»**, **«մենք»**, **«մեզ»**), և Restaurant OS-ին բաժանորդագրվող բիզնեսի (**«Հաճախորդ»**, **«դուք»**) միջև։",
        },
        {
          type: "p",
          text: "Հաշիվ ստեղծելով, անվճար փորձաշրջան սկսելով կամ հարթակն օգտագործելով՝ դուք ընդունում եք սույն Պայմանները։ Restaurant OS-ն առաջարկվում է **միայն բիզնես օգտագործման համար**․ ընդունելով՝ դուք հաստատում եք, որ գործում եք բիզնեսի անունից, և որ ընդունող անձն իրավասու է պարտավորեցնել այն։ Եթե համաձայն չեք, մի՛ օգտագործեք հարթակը։",
        },
      ],
    },
    {
      id: "service",
      title: "2. Ծառայությունը և ձեր մուտքի տվյալները",
      blocks: [
        {
          type: "p",
          text: "Restaurant OS-ը ռեստորան վարելու ամպային հարթակ է, որը կարող է ներառել **ադմինիստրատիվ վահանակ**, **վաճառքի կետ (POS)**, **խոհանոցի էկրան (KDS)**, **սեղաններ և ամրագրումներ** և **հաճախորդին ուղղված QR ճաշացանկ ու պատվիրման** փորձառություն՝ ձեր պլանի համար մեր կայքում նկարագրված հնարավորությունների հետ միասին։",
        },
        {
          type: "p",
          text: "Գրանցման ժամանակ մենք Հաճախորդին տրամադրում ենք համապատասխան բաղադրիչների **մուտքի տվյալներ**։ Դուք պատասխանատու եք ձեր բիզնեսում մուտքն ըստ անհրաժեշտության բաշխելու և մուտքի տվյալները գաղտնի պահելու համար (տես [Ձեր հաշիվը և պարտականությունները](#account))։",
        },
      ],
    },
    {
      id: "account",
      title: "3. Ձեր հաշիվը, մուտքի տվյալները և պարտականությունները",
      blocks: [
        {
          type: "list",
          items: [
            "Դուք պետք է պահեք հաշվի մուտքի տվյալները **անվտանգ և գաղտնի** և անհապաղ տեղեկացնեք մեզ չթույլատրված մուտքի ցանկացած կասկածի մասին։",
            "Դուք պատասխանատու եք ձեր հաշվի ներքո կատարված ողջ գործունեության, այդ թվում՝ ձեր **աշխատակից օգտատերերի** գործողությունների համար, և նրանց լիազորված լինելը և սույն Պայմաններին համապատասխանելը ապահովելու համար։",
            "Դուք պատասխանատու եք ձեր սեփական **բովանդակության** համար — ներառյալ ճաշացանկերը, նկարագրությունները, գները, պատկերները և հարկային կարգավորումները — և դրա ճշգրտության ու օրինականության համար։",
            "Դուք պատասխանատու եք ձեր **վերջնական հաճախորդների տվյալների** համար, որ հավաքում եք հարթակի միջոցով, և որպես դրա վերահսկող՝ դրանք օրինական կերպով մշակելու համար (տես [Տվյալների պաշտպանություն](#data-processing))։",
            "Դուք մնում եք միանձնյա պատասխանատու ձեր սեփական **իրավական, հարկային և ֆիսկալ պարտավորությունների** համար։",
          ],
        },
        {
          type: "callout",
          tone: "warning",
          title: "Հարթակը չի կարգավորում ձեր հարկերը կամ ֆիսկալ կտրոնները",
          text: "Restaurant OS-ը գործառնական ծրագիր է։ Այն **չի** ներկայացնում ձեր հարկային հայտարարագրերը, չի հաշվարկում ձեր հարկային պարտավորությունը և չի թողարկում ձեր անունից օրինականորեն համապատասխան ֆիսկալ կտրոններ։ Հայկական օրենսդրությամբ ֆիսկալ սարքի, կտրոնի և հարկային պահանջները կատարելը մնում է ամբողջությամբ ձեր պատասխանատվությունը։ **[Confirm fiscal/receipt scope with your accountant and legal adviser.]**",
        },
      ],
    },
    {
      id: "trial-billing",
      title: "4. Անվճար փորձաշրջան, բաժանորդագրություններ և վճարում",
      blocks: [
        {
          type: "sub",
          text: "7-օրյա անվճար փորձաշրջան",
        },
        {
          type: "p",
          text: "Նոր Հաճախորդները կարող են սկսել **7-օրյա անվճար փորձաշրջան**։ Դուք կարող եք **ցանկացած պահի չեղարկել նախքան փորձաշրջանի ավարտը՝ որևէ գանձումից խուսափելու համար**։ Եթե փորձաշրջանի ավարտից առաջ չեղարկում չկատարեք, ձեր բաժանորդագրությունը սկսվում է, և կիրառելի վճարները դառնում են վճարման ենթակա։",
        },
        {
          type: "sub",
          text: "Բաժանորդագրություններ, երկարաձգում և գնի փոփոխություններ",
        },
        {
          type: "list",
          items: [
            "Բաժանորդագրություններն առաջարկվում են մեր կայքում կամ ձեր պատվերում ցուցադրված **պլաններով** և գներով՝ յուրաքանչյուր վճարման ժամանակահատվածի համար նախապես գանձվող։",
            "Բաժանորդագրությունները **երկարաձգվում են ինքնաշխատ կերպով** հաջորդական ժամանակահատվածների համար, եթե չեն չեղարկվում նախքան երկարաձգման ամսաթիվը։",
            "Մենք կարող ենք փոխել գները կամ պլանները ապագա վճարման ժամանակահատվածների համար և կտրամադրենք **ողջամիտ կանխավ ծանուցում**։ Փոփոխության ուժի մեջ մտնելուց հետո շարունակական օգտագործումը նշանակում է, որ դուք ընդունում եք նոր գինը։",
          ],
        },
        {
          type: "callout",
          tone: "warning",
          title: "Վճարները չեն վերադարձվում անվճար փորձաշրջանից հետո",
          text: "Անվճար փորձաշրջանի ավարտից հետո **բաժանորդագրության վճարները չեն վերադարձվում**, ներառյալ մասնակի ժամանակահատվածների կամ չօգտագործված ժամանակի համար, բացառությամբ այն դեպքերի, երբ վերադարձը պահանջվում է կիրառելի հայկական օրենսդրությամբ։ Գանձումից խուսափելու համար չեղարկեք **նախքան** անվճար փորձաշրջանի ավարտը։",
        },
        {
          type: "p",
          text: "Գները կարող են **ենթակա լինել ավելացված արժեքի հարկի (VAT)** կամ հայկական օրենսդրությամբ կիրառելի այլ հարկերի, որոնք կարող են ավելացվել ցուցադրված գումարներին։ **[Confirm VAT treatment and invoicing requirements with your accountant.]**",
        },
      ],
    },
    {
      id: "custom",
      title: "5. Հատուկ և եզակի հնարավորություններ",
      blocks: [
        {
          type: "p",
          text: "Ըստ հարցման՝ մենք կարող ենք առաջարկել **հատուկ կամ եզակի հնարավորություններ**՝ ձեր ստանդարտ պլանից դուրս։ Ցանկացած նման աշխատանք տրամադրվում է միայն **առանձին ծավալով, վճարով և գրավոր համաձայնագրով**․ մենք պարտավորություն չունենք հատուկ աշխատանք ստեղծելու, քանի դեռ և եթե դա չենք համաձայնեցրել գրավոր։",
        },
        {
          type: "p",
          text: "Եթե առանձին համաձայնագիրն այլ բան չի սահմանում, **հատուկ աշխատանքի մտավոր սեփականությունը մնում է Ընկերությանը**, և դուք ստանում եք լիցենզիա՝ այն ծառայության շրջանակում օգտագործելու համար։ **[Specify IP ownership and licensing terms for custom work in the separate agreement.]**",
        },
      ],
    },
    {
      id: "acceptable-use",
      title: "6. Ընդունելի օգտագործում և սահմանափակումներ",
      blocks: [
        {
          type: "p",
          text: "Դուք համաձայնում եք չանել և ձեր օգտատերերին չթույլատրել՝",
        },
        {
          type: "list",
          items: [
            "օգտագործել հարթակն ապօրինի կերպով, կամ պահել կամ փոխանցել ապօրինի, իրավունք խախտող կամ վնասակար բովանդակություն․",
            "փորձել ստանալ չթույլատրված մուտք, խաթարել կամ վտանգել հարթակը կամ դրա անվտանգությունը․",
            "հակադարձ ինժեներիա անել, պատճենել, վերավաճառել կամ ենթալիցենզավորել հարթակը, բացառությամբ օրենքով թույլատրված դեպքերի․",
            "օգտագործել հարթակը չպահանջված հաղորդագրություններ ուղարկելու կամ առանց իրավական հիմքի տվյալներ մշակելու համար․ կամ",
            "խանգարել այլ հաճախորդների՝ ծառայության օգտագործմանը։",
          ],
        },
      ],
    },
    {
      id: "data-processing",
      title: "7. Տվյալների պաշտպանություն և մշակում",
      blocks: [
        {
          type: "p",
          text: "Անձնական տվյալների հետ մեր վերաբերմունքը նկարագրված է մեր [Գաղտնիության քաղաքականության](/legal/privacy) մեջ։ Հարթակ մուտքագրվող գործառնական տվյալների համար — ներառյալ ձեր աշխատակից օգտատերերը և ձեր վերջնական հաճախորդների տվյալները — **դուք վերահսկողն եք, իսկ մենք հանդես ենք գալիս որպես ձեր մշակող**՝ մշակելով դրանք ձեր հրահանգներով՝ ծառայությունը մատուցելու համար։",
        },
        {
          type: "p",
          text: "Անհրաժեշտության դեպքում այս մշակումը կարգավորվում է **տվյալների մշակման հավելվածով (DPA)**, որը կազմում է սույն Պայմանների մասը։ Դուք պատասխանատու եք այդ տվյալները հավաքելու և օգտագործելու իրավական հիմք ունենալու և ձեր վերջնական հաճախորդների իրավունքները հարգելու համար։ **[Attach or link the DPA.]**",
        },
      ],
    },
    {
      id: "availability",
      title: "8. Հասանելիություն, սպասարկում և բետա հնարավորություններ",
      blocks: [
        {
          type: "p",
          text: "Մենք աշխատում ենք հարթակը հասանելի և հուսալի պահել, սակայն չենք երաշխավորում անխափան կամ առանց սխալների աշխատանք։ Մենք կարող ենք կատարել **սպասարկում** և անհրաժեշտության դեպքում ժամանակավորապես կասեցնել ծառայության մասերը՝ ձգտելով նվազագույնի հասցնել խափանումը և, հնարավորության դեպքում, ծանուցել պլանավորված անջատման մասին։",
        },
        {
          type: "p",
          text: "Մենք կարող ենք առաջարկել **բետա կամ նախադիտման հնարավորություններ**, որոնք հստակ նշված են որպես այդպիսին։ Դրանք տրամադրվում են «ինչպես կա» սկզբունքով, կարող են փոխվել կամ հանվել, և չպետք է հիմք ընդունվեն կարևոր գործառնությունների համար։",
        },
      ],
    },
    {
      id: "warranties",
      title: "9. Ծառայությունը տրամադրվում է «ինչպես կա»",
      blocks: [
        {
          type: "p",
          text: "Հայկական օրենսդրությամբ թույլատրված առավելագույն չափով՝ հարթակը տրամադրվում է **«ինչպես կա» և «ինչպես հասանելի է»** սկզբունքով՝ առանց որևէ տեսակի երաշխիքների, լինեն դրանք ուղղակի թե ենթադրյալ, ներառյալ որոշակի նպատակի համար պիտանիությունը և իրավունքի չխախտումը։ Մենք չենք երաշխավորում, որ հարթակը կբավարարի ձեր բիզնեսի յուրաքանչյուր պահանջ։",
        },
      ],
    },
    {
      id: "liability",
      title: "10. Պատասխանատվության սահմանափակում",
      blocks: [
        {
          type: "p",
          text: "Հայկական օրենսդրությամբ թույլատրված չափով՝ Ընկերությունը պատասխանատու չէ անուղղակի, պատահական կամ հետևանքային կորուստների, կամ կորցրած շահույթի, եկամտի, գուդվիլի կամ տվյալների համար։ **[Specify the aggregate liability cap — e.g. the fees paid in the preceding 12 months.]**",
        },
        {
          type: "callout",
          tone: "note",
          text: "Սույն Պայմաններում ոչինչ չի բացառում կամ սահմանափակում այն պատասխանատվությունը, որը չի կարող բացառվել կամ սահմանափակվել Հայաստանի Հանրապետության օրենսդրությամբ։",
        },
      ],
    },
    {
      id: "suspension",
      title: "11. Կասեցում և դադարեցում",
      blocks: [
        {
          type: "p",
          text: "Դուք կարող եք ցանկացած պահի չեղարկել ձեր բաժանորդագրությունը՝ ուժի մեջ ընթացիկ վճարման ժամանակահատվածի վերջում (ենթակա [Անվճար փորձաշրջան, բաժանորդագրություններ և վճարում](#trial-billing) բաժնում նշված չվերադարձման կանոնին)։",
        },
        {
          type: "p",
          text: "Մենք կարող ենք **կասեցնել կամ դադարեցնել** մուտքը, երբ դուք խախտում եք սույն Պայմանները, այդ թվում՝ **չվճարման** համար։ Չվճարման կամ խախտման համար կասեցումը **արգելափակում է մուտքը հարթակ**, մինչև խնդիրը լուծվի։ Մենք կծանուցենք, երբ դա ողջամիտ և գործնականում հնարավոր է։",
        },
        {
          type: "sub",
          text: "Դադարեցման հետևանքը",
        },
        {
          type: "p",
          text: "Դադարեցման դեպքում ձեր՝ հարթակն օգտագործելու իրավունքը դադարում է։ Մենք ձեր տվյալները հասանելի կդարձնենք **արտահանման** համար սահմանափակ ժամանակահատվածում, որից հետո դրանք **ջնջվում կամ անանունացվում են**՝ մեր [Գաղտնիության քաղաքականությանը](/legal/privacy) համապատասխան։ **[Confirm the export window and deletion timeline.]**",
        },
      ],
    },
    {
      id: "ip",
      title: "12. Մտավոր սեփականություն և գաղտնիություն",
      blocks: [
        {
          type: "p",
          text: "Հարթակը, դրա ծրագրակազմը, դիզայնը և բրենդը պատկանում են Ընկերությանը և նրա լիցենզատուներին․ սույն Պայմաններում ոչինչ չի փոխանցում այդ մտավոր սեփականությունը ձեզ՝ ծառայությունն օգտագործելու սահմանափակ իրավունքից դուրս։ **Ձեր տվյալներն ու բովանդակությունը մնում են ձերը** — դուք մեզ տրամադրում եք միայն այն լիցենզիան, որ անհրաժեշտ է դրանք հոստինգ անելու և մշակելու համար՝ ծառայությունը մատուցելու նպատակով։",
        },
        {
          type: "p",
          text: "Յուրաքանչյուր կողմ կպահի մյուսի ոչ հանրային տեղեկությունը գաղտնի և կօգտագործի այն միայն այնքանով, որքանով անհրաժեշտ է սույն Պայմանները կատարելու համար, բացառությամբ այն դեպքերի, երբ բացահայտումը պահանջվում է օրենքով։",
        },
      ],
    },
    {
      id: "governing-law",
      title: "13. Կիրառելի իրավունք և վեճեր",
      blocks: [
        {
          type: "p",
          text: "Սույն Պայմանները կարգավորվում են **Հայաստանի Հանրապետության** իրավունքով։ Կողմերը նախ կփորձեն բարեխղճորեն լուծել ցանկացած վեճ։ Դրա ձախողման դեպքում վեճերը ենթակա են **Հայաստանի Հանրապետության դատարաններին (Yerevan)**։ **[Or specify arbitration — e.g. a named arbitration body, seat and rules — if preferred.]**",
        },
      ],
    },
    {
      id: "changes",
      title: "14. Սույն պայմանների փոփոխությունները",
      blocks: [
        {
          type: "p",
          text: "Մենք կարող ենք ժամանակ առ ժամանակ թարմացնել սույն Պայմանները։ Մենք կվերանայենք վերևի «Վերջին թարմացում» ամսաթիվը և կտրամադրենք **ողջամիտ ծանուցում** էական փոփոխությունների մասին (օրինակ՝ էլ․ փոստով կամ ապրանքի ներսում ծանուցմամբ)։ Փոփոխության ուժի մեջ մտնելուց հետո հարթակի շարունակական օգտագործումը նշանակում է, որ դուք ընդունում եք թարմացված Պայմանները։",
        },
      ],
    },
    {
      id: "contact",
      title: "15. Կապ",
      blocks: [
        {
          type: "p",
          text: "Սույն Պայմանների վերաբերյալ հարցերը կարող եք ուղարկել **[LEGAL ENTITY NAME]**-ին **[EMAIL]** հասցեով։ Գրանցված հասցե՝ **[REGISTERED ADDRESS, YEREVAN, ARMENIA]**։",
        },
      ],
    },
  ],
};

/* ============================================================================
   TERMS & CONDITIONS — Russian (ru) — DRAFT translation, pending lawyer review
   ========================================================================== */

const termsRu: LegalDoc = {
  title: "Условия и положения",
  intro:
    "Соглашение между **[LEGAL ENTITY NAME]** и предприятиями, которые оформляют подписку на платформу Restaurant OS.",
  sections: [
    {
      id: "acceptance",
      title: "1. Принятие и право на использование",
      blocks: [
        {
          type: "p",
          text: "Настоящие Условия и положения (**«Условия»**) образуют обязательное соглашение между **[LEGAL ENTITY NAME]**, регистрационный номер **[REGISTRATION No.]**, зарегистрированной в **Yerevan, Republic of Armenia** (**«Компания»**, **«мы»**, **«нас»**), и предприятием, которое оформляет подписку на Restaurant OS (**«Клиент»**, **«вы»**).",
        },
        {
          type: "p",
          text: "Создавая учётную запись, начиная бесплатный пробный период или используя платформу, вы принимаете настоящие Условия. Restaurant OS предлагается **исключительно для делового использования**; принимая Условия, вы подтверждаете, что действуете от имени предприятия и что принимающее лицо имеет полномочия связать его обязательствами. Если вы не согласны, не используйте платформу.",
        },
      ],
    },
    {
      id: "service",
      title: "2. Сервис и ваши учётные данные",
      blocks: [
        {
          type: "p",
          text: "Restaurant OS — это облачная платформа для управления рестораном, которая может включать **панель администрирования**, **точку продаж (POS)**, **кухонный дисплей (KDS)**, **столы и бронирования** и **обращённый к клиенту QR-меню и оформление заказов**, вместе с функциями, описанными на нашем веб-сайте для вашего тарифного плана.",
        },
        {
          type: "p",
          text: "При регистрации мы выдаём Клиенту **учётные данные для входа** для соответствующих компонентов. Вы несёте ответственность за надлежащее распределение доступа внутри вашего предприятия и за сохранение конфиденциальности учётных данных (см. [Ваша учётная запись и обязанности](#account)).",
        },
      ],
    },
    {
      id: "account",
      title: "3. Ваша учётная запись, учётные данные и обязанности",
      blocks: [
        {
          type: "list",
          items: [
            "Вы должны хранить учётные данные **в безопасности и конфиденциально** и незамедлительно уведомлять нас о любом подозрении на несанкционированный доступ.",
            "Вы несёте ответственность за всю активность под вашей учётной записью, включая действия ваших **пользователей-сотрудников**, и за обеспечение того, что они уполномочены и соблюдают настоящие Условия.",
            "Вы несёте ответственность за своё собственное **содержимое** — включая меню, описания, цены, изображения и налоговые настройки — и за его точность и законность.",
            "Вы несёте ответственность за **данные ваших конечных клиентов**, которые вы собираете через платформу, и за их законную обработку в качестве их контролёра (см. [Защита данных](#data-processing)).",
            "Вы остаётесь единолично ответственным за свои собственные **правовые, налоговые и фискальные обязательства**.",
          ],
        },
        {
          type: "callout",
          tone: "warning",
          title: "Платформа не занимается вашими налогами или фискальными чеками",
          text: "Restaurant OS — это операционное программное обеспечение. Оно **не** подаёт ваши налоговые декларации, не рассчитывает вашу налоговую обязанность и не выпускает от вашего имени юридически соответствующие фискальные чеки. Выполнение требований к фискальному устройству, чекам и налогам согласно армянскому законодательству остаётся полностью вашей ответственностью. **[Confirm fiscal/receipt scope with your accountant and legal adviser.]**",
        },
      ],
    },
    {
      id: "trial-billing",
      title: "4. Бесплатный пробный период, подписки и выставление счетов",
      blocks: [
        {
          type: "sub",
          text: "7-дневный бесплатный пробный период",
        },
        {
          type: "p",
          text: "Новые Клиенты могут начать **7-дневный бесплатный пробный период**. Вы можете **отменить в любое время до окончания пробного периода, чтобы избежать любого списания**. Если вы не отмените до окончания пробного периода, ваша подписка начинается, и применимые платежи становятся подлежащими оплате.",
        },
        {
          type: "sub",
          text: "Подписки, продление и изменения цен",
        },
        {
          type: "list",
          items: [
            "Подписки предлагаются по **тарифным планам** и ценам, указанным на нашем веб-сайте или в вашем заказе, с выставлением счёта авансом за каждый расчётный период.",
            "Подписки **продлеваются автоматически** на последующие периоды, если не отменены до даты продления.",
            "Мы можем изменять цены или тарифные планы для будущих расчётных периодов и предоставим **разумное предварительное уведомление**. Продолжение использования после вступления изменения в силу означает, что вы принимаете новую цену.",
          ],
        },
        {
          type: "callout",
          tone: "warning",
          title: "Платежи не подлежат возврату после бесплатного пробного периода",
          text: "После окончания бесплатного пробного периода **плата за подписку не подлежит возврату**, в том числе за неполные периоды или неиспользованное время, за исключением случаев, когда возврат требуется применимым армянским законодательством. Чтобы избежать списания, отмените **до** окончания бесплатного пробного периода.",
        },
        {
          type: "p",
          text: "Цены могут **облагаться налогом на добавленную стоимость (VAT)** или другими применимыми налогами согласно армянскому законодательству, которые могут быть добавлены к указанным суммам. **[Confirm VAT treatment and invoicing requirements with your accountant.]**",
        },
      ],
    },
    {
      id: "custom",
      title: "5. Индивидуальные и уникальные функции",
      blocks: [
        {
          type: "p",
          text: "По запросу мы можем предложить **индивидуальные или уникальные функции** сверх вашего стандартного тарифного плана. Любая такая работа предоставляется только в рамках **отдельного объёма работ, платы и письменного соглашения**; мы не обязаны разрабатывать индивидуальную работу, пока и если не согласуем это в письменной форме.",
        },
        {
          type: "p",
          text: "Если отдельное соглашение не предусматривает иного, **интеллектуальная собственность на индивидуальную работу остаётся у Компании**, а вы получаете лицензию на её использование в составе сервиса. **[Specify IP ownership and licensing terms for custom work in the separate agreement.]**",
        },
      ],
    },
    {
      id: "acceptable-use",
      title: "6. Допустимое использование и ограничения",
      blocks: [
        {
          type: "p",
          text: "Вы соглашаетесь не делать и не позволять вашим пользователям:",
        },
        {
          type: "list",
          items: [
            "использовать платформу незаконно, или хранить либо передавать незаконное, нарушающее права или вредоносное содержимое;",
            "пытаться получить несанкционированный доступ, нарушить работу или скомпрометировать платформу или её безопасность;",
            "осуществлять обратную разработку, копировать, перепродавать или сублицензировать платформу, за исключением случаев, разрешённых законом;",
            "использовать платформу для отправки незапрошенных сообщений или для обработки данных без правового основания; или",
            "препятствовать использованию сервиса другими клиентами.",
          ],
        },
      ],
    },
    {
      id: "data-processing",
      title: "7. Защита и обработка данных",
      blocks: [
        {
          type: "p",
          text: "Наша обработка персональных данных описана в нашей [Политике конфиденциальности](/legal/privacy). В отношении операционных данных, которые вы вводите в платформу — включая ваших пользователей-сотрудников и данные ваших конечных клиентов — **вы являетесь контролёром, а мы выступаем в роли вашего обработчика**, обрабатывая их по вашим указаниям для предоставления сервиса.",
        },
        {
          type: "p",
          text: "Где это требуется, такая обработка регулируется **дополнительным соглашением об обработке данных (DPA)**, которое является частью настоящих Условий. Вы несёте ответственность за наличие правового основания для сбора и использования этих данных и за соблюдение прав ваших конечных клиентов. **[Attach or link the DPA.]**",
        },
      ],
    },
    {
      id: "availability",
      title: "8. Доступность, обслуживание и бета-функции",
      blocks: [
        {
          type: "p",
          text: "Мы работаем над тем, чтобы поддерживать платформу доступной и надёжной, но не гарантируем бесперебойную или безошибочную работу. Мы можем проводить **обслуживание** и при необходимости временно приостанавливать части сервиса, стремясь свести к минимуму перебои и, где это практически возможно, уведомлять о запланированных простоях.",
        },
        {
          type: "p",
          text: "Мы можем предлагать **бета- или предварительные функции**, которые чётко обозначены как таковые. Они предоставляются «как есть», могут изменяться или быть отозваны и не должны использоваться для критически важных операций.",
        },
      ],
    },
    {
      id: "warranties",
      title: "9. Сервис предоставляется «как есть»",
      blocks: [
        {
          type: "p",
          text: "В максимальной степени, допускаемой армянским законодательством, платформа предоставляется **«как есть» и «как доступно»**, без каких-либо гарантий, явных или подразумеваемых, включая пригодность для определённой цели и ненарушение прав. Мы не гарантируем, что платформа будет соответствовать каждому требованию вашего предприятия.",
        },
      ],
    },
    {
      id: "liability",
      title: "10. Ограничение ответственности",
      blocks: [
        {
          type: "p",
          text: "В степени, допускаемой армянским законодательством, Компания не несёт ответственности за косвенные, случайные или сопутствующие убытки, либо за упущенную прибыль, доход, деловую репутацию или данные. **[Specify the aggregate liability cap — e.g. the fees paid in the preceding 12 months.]**",
        },
        {
          type: "callout",
          tone: "note",
          text: "Ничто в настоящих Условиях не исключает и не ограничивает ответственность, которая не может быть исключена или ограничена согласно законодательству Республики Армения.",
        },
      ],
    },
    {
      id: "suspension",
      title: "11. Приостановление и прекращение",
      blocks: [
        {
          type: "p",
          text: "Вы можете отменить вашу подписку в любое время, с вступлением в силу в конце текущего расчётного периода (с учётом правила о невозврате в разделе [Бесплатный пробный период, подписки и выставление счетов](#trial-billing)).",
        },
        {
          type: "p",
          text: "Мы можем **приостановить или прекратить** доступ при нарушении вами настоящих Условий, в том числе за **неоплату**. Приостановление за неоплату или нарушение **блокирует доступ к платформе** до тех пор, пока вопрос не будет решён. Мы предоставим уведомление, где это разумно и практически возможно.",
        },
        {
          type: "sub",
          text: "Последствия прекращения",
        },
        {
          type: "p",
          text: "При прекращении ваше право на использование платформы прекращается. Мы сделаем ваши данные доступными для **экспорта** в течение ограниченного периода, после чего они **удаляются или анонимизируются** в соответствии с нашей [Политикой конфиденциальности](/legal/privacy). **[Confirm the export window and deletion timeline.]**",
        },
      ],
    },
    {
      id: "ip",
      title: "12. Интеллектуальная собственность и конфиденциальность",
      blocks: [
        {
          type: "p",
          text: "Платформа, её программное обеспечение, дизайн и бренд принадлежат Компании и её лицензиарам; ничто в настоящих Условиях не передаёт вам эту интеллектуальную собственность сверх ограниченного права на использование сервиса. **Ваши данные и содержимое остаются вашими** — вы предоставляете нам только лицензию, необходимую для их размещения и обработки в целях предоставления сервиса.",
        },
        {
          type: "p",
          text: "Каждая сторона будет хранить непубличную информацию другой стороны конфиденциально и использовать её только по мере необходимости для исполнения настоящих Условий, за исключением случаев, когда раскрытие требуется по закону.",
        },
      ],
    },
    {
      id: "governing-law",
      title: "13. Применимое право и споры",
      blocks: [
        {
          type: "p",
          text: "Настоящие Условия регулируются правом **Республики Армения**. Стороны сначала попытаются добросовестно разрешить любой спор. В случае неудачи споры подлежат рассмотрению **судами Республики Армения (Yerevan)**. **[Or specify arbitration — e.g. a named arbitration body, seat and rules — if preferred.]**",
        },
      ],
    },
    {
      id: "changes",
      title: "14. Изменения настоящих условий",
      blocks: [
        {
          type: "p",
          text: "Мы можем время от времени обновлять настоящие Условия. Мы изменим указанную выше дату «Последнее обновление» и предоставим **разумное уведомление** о существенных изменениях (например, по электронной почте или уведомлением в продукте). Продолжение использования платформы после вступления изменения в силу означает, что вы принимаете обновлённые Условия.",
        },
      ],
    },
    {
      id: "contact",
      title: "15. Контакты",
      blocks: [
        {
          type: "p",
          text: "Вопросы о настоящих Условиях можно направлять в **[LEGAL ENTITY NAME]** по адресу **[EMAIL]**. Зарегистрированный адрес: **[REGISTERED ADDRESS, YEREVAN, ARMENIA]**.",
        },
      ],
    },
  ],
};

/* ============================================================================
   Document registry + locale helpers
   ========================================================================== */

/**
 * Per-document content keyed by locale. English is authored in full and is the
 * controlling language for now. Armenian (hy) and Russian (ru) are deliberate
 * stubs (`undefined`) until translated and reviewed — the page falls back to
 * English and shows a clear "translation pending" notice.
 */
export const legalDocs: Record<LegalDocKey, Partial<Record<Locale, LegalDoc>>> = {
  privacy: { en: privacyEn, hy: privacyHy, ru: privacyRu },
  terms: { en: termsEn, hy: termsHy, ru: termsRu },
};

/**
 * Resolve the document to render for a requested locale, plus whether it is the
 * real translation or an English fallback.
 */
export function resolveLegalDoc(
  key: LegalDocKey,
  locale: Locale,
): { doc: LegalDoc; isFallback: boolean } {
  const byLocale = legalDocs[key];
  const exact = byLocale[locale];
  if (exact) return { doc: exact, isFallback: false };
  // English is always present and acts as the fallback source text.
  return { doc: byLocale.en as LegalDoc, isFallback: locale !== "en" };
}
