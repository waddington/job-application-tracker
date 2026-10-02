# Using the app

A tour of every page. The sidebar has them all; the search box at the top (press <kbd>/</kbd>)
finds anything.

## The basics: companies, roles and applications

- A **company** is somewhere you might work.
- A **role** is a job at a company (title, location, work mode, salary range or day rate
  and IR35).
- An **application** is you going for a role, by one **route**: directly, through an
  agency or recruiter, or by referral. Most of the app is about applications.
- An **agency** is a recruitment agency. A **person** is anyone you deal with: an agency
  recruiter, an in-house recruiter or head of talent, a hiring manager, an interviewer, a
  referrer. Each has a page with as many emails, phone numbers and links as you like.

Create an application with **New application** on the Applications page: pick or type the
company and role, and how it came about:

- **Directly**: you applied, or someone at the company reached out. Put them in *Who reached
  out?* (an in-house recruiter or head of talent) and they're added as a person at the
  company.
- **Through a recruiter**: an agency and/or a recruiter there.
- **Referral**: link the person who referred you from the application's People card.

Companies, roles, agencies and people typed in for the first time are created for you.

## Next actions (home)

What needs doing, newest problems first:

- **Offers to answer**: pending offers with a reply due in the next two weeks, or overdue.
- **How did it go?**: interview rounds whose time has passed; mark them *Done* or *Didn't
  happen*.
- **Follow up**: applications whose follow-up date is today or earlier.
- **Coming up**: interviews and task deadlines in the next two weeks, then rounds not
  booked yet.
- **Gone quiet**: active applications with no activity for as long as their stage allows
  or more (7 days in Applied, 5 in Screen and Interviewing, and so on; see
  [Customising](customising.md)).

On each one: set a follow-up date (tomorrow, in 3 days, next week), **snooze** it (3 days,
1 week, 2 weeks) so it stops nagging, or mark it **Ghosted**. A snoozed application, one with
a follow-up date in the future, or one with an interview booked ahead never counts as gone
quiet.

## Applications: list and board

The **list** has search (company, role, recruiter) and filters: stage, route, agency,
*Needs chasing*, and *Archived* (shows only archived applications). Click a row for a quick
view; open the full page from there.

The **board** shows a column per stage. Drag a card to move it; the usual next stages are
highlighted while you drag. Closed stages (Rejected, Withdrawn…) are hidden unless you
switch on *Show closed stages*, but appear while you drag so you can drop a card on them. Cards show the current interview round.

Every stage change is timestamped on the application's timeline, and **Undo last move**
reverts a mistake. By default you can move between any stages; you can make them strict
instead ([Customising](customising.md#strict-jira-style-transitions)).

## An application's page

Everything about one application:

- **Move to…**, **Undo last move**, and its stage, current round and tags.
- **Details**: applied date, follow-up date, snooze, tags, and **Archived**.
- **Interviews**: numbered rounds in your own words ("Round 2 · Engineering manager chat"),
  with type, time or deadline, format and link, interviewers, prep, debrief, questions asked,
  and take-home briefs and repos.
- **Documents sent**: which version of your CV and cover letter went with it.
- **Offer**: pay and terms, and revised offers (see [Offers](#offers)).
- **Notes**, **Links** (job ads, Google Docs, repos) and **Files** (PDFs, images, exported
  emails).
- **People**: who's involved, and as what (agency recruiter, internal recruiter / talent,
  hiring manager, interviewer, referrer, other). Pick someone you already have and **Link
  person**, or **New person** to add someone and link them in one go (they start at the
  application's company).
- **Log activity**: record a call, email, message or anything else on the timeline.
- **Timeline**: every stage move, activity, interview change and offer, in order.

### Emails

Export an email from your mail client as a `.eml` file and drop it on the **Files** card.
The app reads its subject, sender, date and a snippet, and puts it on the timeline at the
time it was sent. The file itself is kept too.

### Archiving and deleting

- **Archive** (the switch in Details) hides an application from the list, board and Next
  actions without losing anything. It still counts in Insights, which are about your whole
  search. Find archived applications with the
  *Archived* filter on the Applications page, or with search. Switch it off to bring it back.
- **Delete** (top right of the page) removes it for good, with its interviews, offer,
  timeline, record of documents sent and links. Its notes and files stay (files become
  unattached).

Companies, agencies, roles and people have **Delete** too:

| Deleting | Also removes | Keeps |
|---|---|---|
| A company | its roles and their links | its people (no longer at a company), notes and files |
| A role | nothing else | — |
| An agency | nothing else | its recruiters and applications (no longer with an agency) |
| A person | them from applications and interviews | the applications |

A company or role that still has applications can't be deleted: delete or archive those
first. Your data repo's history still has everything until you rewrite it.

## People, recruiters and agencies

The **Recruiters** page lists everyone: agencies and their recruiters, people at companies,
and independents, with every email, phone number and link (click to email, call or open).
**New agency** and **New person** are at the top right. In a person's form you can also type
a new agency or company name and pick **+ Add "…"** to create it there and then.

Each **person** has a page, a dossier: their job title and where they work, how to reach
them, every application they're part of (and as what), the interviews they were in, and your
notes, links and files about them. Click a name anywhere to open it; **Edit** and **Delete**
are at the top.

An **agency page** shows its recruiters and every role it put you forward for. Applications
for the same job through two routes (say, directly and via an agency) show a **duplicate
warning**.

## Companies

A list of companies with how many applications and how many need chasing. A **company
page** has its applications, roles, people (**Add person** for the people you talk to there),
an *About* box, notes, links and files. **Edit** at the top renames it or sets its website;
agencies have the same.

## Interviews

Every interview round across all applications: what's coming up, then everything earlier
or cancelled.

## Offers

Add an offer from the application's page. A **permanent** or **fixed-term** offer has base
salary, expected bonus, equity (in words, plus your estimate of its worth a year), employer
pension, holiday and benefits; a **contract** has a day rate, IR35 status and length. Add a
revised offer after negotiating: the newest one counts.

The **Offers** page puts them side by side, best first, with a *worth a year* figure:
salary + bonus + equity estimate + employer pension, or the day rate × 220 working days. It
compares like with like only roughly: read the rows, not just the total.

## Documents

Your CVs and cover letters, each with versions ("v3 (fintech)") and the file for each. The
application page records which version you sent, and the Documents page shows where each
version went.

## Notes

Markdown notes, attached to an application, company, agency or person, or on their own.
Each is a real `.md` file in your data folder (see [Your data](your-data.md#whats-in-the-folder)),
so you can also write and edit them in any editor. Tables, checklists and links work.

## Insights

How the search is going, for all time or the last 30 or 90 days:

- **Where applications go**: a Sankey diagram of applications flowing through the stages;
  filter by route, hover for counts.
- **Stage by stage**: how many reached each stage, how many moved on, and the median time
  spent there.
- **Direct vs recruiter**: the share of each route's applications that got to each stage.
- **Recruiter scorecard**: per recruiter or agency, roles sent, how many got interviews,
  where they ended up, how long until the first update, and when you last heard from them.
- **Weekly activity**: applications added and sent, stage moves and interviews per week.

## Search

Type in the box at the top (or press <kbd>/</kbd>) and press Enter. It finds applications,
companies, agencies, people (including their emails and phone numbers), interview prep and
debriefs, offers, timeline entries, notes, documents, files, emails and links. Every word
must match; case and accents don't matter.

## Dark mode

The moon/sun button at the top right.
