/**
 * The demo corpus — a fictional small SaaS company ("Lumenfield") whose
 * internal docs exercise all four query shapes a visitor should see:
 *
 *   1. single-document factual      ("How many days of PTO…?")
 *   2. rare-token specific fact     ("What is runbook ORB-17 for?")
 *   3. cross-document synthesis     ("What is the current return window, and
 *                                    how did it affect Q3 refunds?")
 *   4. honest abstention            ("…parental leave in the Berlin office?",
 *                                    a topic no document covers)
 *
 * The per-document question lists are ordered deliberately: position 0 and 1
 * of each list form the six chips shown for the "all documents" scope
 * (round-robin across the three docs), and the full list shows when a single
 * document is scoped.
 *
 * `expected` phrases are the acceptance bar for the Phase 11 eval — the
 * correct answer must contain one of them.
 */

export const DEMO_EMAIL = 'demo@acme.test'
export const DEMO_PASSWORD = 'demo-lumenfield-2026'
export const DEMO_NAME = 'Demo'

export type DemoQuestion = {
  /** The question text, stored verbatim in `documents.metadata`. */
  q: string
  /**
   * Phrases the correct answer must contain (Phase 11 eval).
   * Empty for the deliberately un-answerable question.
   */
  expected?: string[]
  /** False only for the un-answerable demo. */
  answerable?: boolean
}

export type DemoDocument = {
  title: string
  text: string
  questions: DemoQuestion[]
}

export const DEMO_CORPUS: DemoDocument[] = [
  {
    title: 'Employee Handbook — Lumenfield',
    text: `Lumenfield Employee Handbook.

Where we work. Lumenfield operates two offices: London and Austin. Most roles are hybrid, and you may work from home up to three days per week. Core collaboration hours are 10:00 to 15:00 in your local time zone.

Annual leave. Full-time employees receive 25 days of paid annual leave per year, plus local public holidays. Up to 5 unused days carry into the next year.

Parental leave. The London and Austin offices offer 16 weeks of paid parental leave for new parents. Leave must start within twelve months of the birth or adoption.

Sick leave. Employees are entitled to 10 paid sick days per year. A doctor's note is required for absences longer than three consecutive days.

Conduct. We keep a short code of conduct: respect colleagues, protect customer data, and disclose conflicts of interest to your manager.`,
    questions: [
      {
        q: 'How many days of paid annual leave do employees get?',
        expected: ['25 days'],
      },
      {
        q: 'What is the parental leave policy in the Berlin office?',
        expected: [],
        answerable: false,
      },
      {
        q: 'How many days per week may employees work from home?',
        expected: ['three days', '3 days'],
      },
      {
        q: 'Which offices does Lumenfield operate?',
        expected: ['London', 'Austin'],
      },
    ],
  },
  {
    title: 'Operations Runbook — Lumenfield',
    text: `Lumenfield Operations Runbook.

Severity levels. SEV-1 means a full outage of the customer-facing product. SEV-2 means a major feature is broken for many customers. SEV-3 and SEV-4 cover minor and cosmetic issues.

Paging the on-call. For a SEV-1 incident, the on-call engineer must page the incident commander within 5 minutes. For SEV-2 the acknowledgement window is 30 minutes.

Runbook ORB-17 — database failover. When the primary database in eu-central-1 is unhealthy, promote the read replica and update the connection string. Runbook ORB-17 must be rehearsed once per quarter.

Refunds and returns. The standard return window is 30 days from delivery. Support agents may extend it by 7 days for damaged items.

Status page and postmortems. Update the status page within 15 minutes of declaring a SEV-1 or SEV-2. Every SEV-1 and SEV-2 gets a blameless postmortem within 48 hours.`,
    questions: [
      {
        q: 'For a SEV-1 incident, how quickly must the on-call engineer page the incident commander?',
        expected: ['5 minutes'],
      },
      {
        q: 'What is runbook ORB-17 for?',
        expected: ['database failover', 'read replica'],
      },
      {
        q: 'What is the standard return window?',
        expected: ['30 days'],
      },
    ],
  },
  {
    title: 'Q3 Business Review — Lumenfield',
    text: `Lumenfield Q3 Business Review.

Revenue. Lumenfield closed Q3 with total revenue of $4.2M, up 9% quarter over quarter. Expansion revenue from existing accounts contributed $1.1M.

Refunds. Refund volume rose 12% in Q3, following the change to the extended return window described in the Operations Runbook. Finance attributes the full increase to the wider window, not to product quality.

Hiring. Headcount grew from 41 to 52. Support hired four agents in Austin to cover the longer return window.

Q4 outlook. The company expects refund volume to settle as customers learn the new window. No other policy changes are planned.`,
    questions: [
      {
        q: 'How did refund volume change in Q3?',
        expected: ['rose 12%', '12%'],
      },
      {
        q: 'What is the current return window, and how did it affect Q3 refunds?',
        expected: ['30 days', 'rose 12%'],
      },
      {
        q: 'What was total revenue in Q3?',
        expected: ['$4.2M', '4.2'],
      },
    ],
  },
]
