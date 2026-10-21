# Phase 12 header decision table

The per-column allow/exclude decision for every Phase 12 file in the capture
`.planning/phases/12-account-timeline-perks/12-HEADERS.txt`, which the user produced
by running `header_capture_12.py` on their own export (plan 12-01, D-04). Column
NAMES only: the capture holds no cell value, no nickname, no email, no account
number and no code. `tests/fixtures/new-data-headers.ts` carries the same names
as typed constants and `tests/unit/guards/new-data-headers.test.ts` re-lints them on
every run (T-12-02).

**This document is the input to plans 12-08, 12-10, 12-11 and 12-13.** Plan 12-08
transcribes the `allow` rows into `SpecFile` entries and the Pane mapping into file
keys. A column marked `allow` here that no spec names still cannot be stored: the
projection is fail-closed.

The capture relabels account folders `ACCT-A`, `ACCT-B` and `ACCT-C` by sort order.
They are stand-ins, not Wargaming account numbers, and are not the same labels as
the Phase 11 capture's unless a file appears in both (only `HEAT_Surveys.csv` does).

## How a row was decided

The interface-block rules of plan 12-01 were applied exactly:

| Rule | What it excludes or allows |
|---|---|
| (a) | Exclude a column whose name contains MAIL, PHONE, BIRTH, BDAY, PASS, TOKEN, SECRET, HASH, UUID, GUID, SPA, LOGIN-as-identity, or that names a person, profile, account, device or session identity. |
| (b) | Exclude a bare `ID` or `*_ID` column that identifies the record itself; allow an ID-like column only when it names a game, product or service object. |
| (c) | A past-nickname column (kind text) is allowed ONLY in `Account_Name_History.csv`. |
| (d) | An IP column (kind address) is allowed ONLY in Bans, Authorized_Third_Parties and Bonus_Codes; excluded everywhere else. |
| (e) | A coupon or bonus code column (kind code) is allowed ONLY in Personal_Coupons and Bonus_Codes. |
| (f) | Dates (kind date), enumerations, flags (kind text) and counters (kind number) are allowed. |
| (g) | Every free-text column is excluded. The user's answer overrides the name: yes or unsure for email, person name or free text excludes the column. |
| (h) | `HEAT_Surveys.PLAYER_ANSWER` is excluded unless the user states it is an enumerated rating. The user stated it is, so it is allowed as kind text. |
| (i) | A file whose header was suppressed, or that no pane uses, gets one line and no table. |

Roles are deterministic: `date` is the first allowed date-kind column in file order;
`primary` is the first allowed non-date column in file order; `secondary` is the next
one or two allowed columns in file order (never a date, never a second primary). A
second or third allowed date column therefore has role `none`. For
`Language_And_Country_History` the language and country roles go to the column the
user named for them (see its table).

## User answers (names only)

Evidence the rules above read. These are the user's answers to the plan 12-01
checkpoint, relayed by the orchestrator.

### Per-column risk (could its VALUES hold an email, a person's name, free text, an address or a code?)

The scan the user ran reports flags only. A flag it raised is recorded `yes`, a flag
it did not raise is `no`, and a column the user said could be free text is `unsure`
(treated as yes). No column was left unanswered, so none defaulted to unsure on all
five.

- Bans / DESCRIPTION: free text yes (spaces, mixed case).
- Bans / REASON: free text yes (up to 190 characters).
- Bans / STATUS: enumeration, no risk.
- Personal_Coupons / PREREQUISITE: free text yes (up to about 10k characters).
- Personal_Coupons / STATUS: enumeration, no risk.
- Personal_Coupons / CODE: code yes.
- Bonus_Code_Usage / CODE_KEY: code yes.
- Bonus_Code_Usage / USER_IP: address yes.
- Authorized_Third_Parties / THIRD_PARTY_SITE: a site name only, no risk.
- Subscriptions / SUBSCRIPTION: the user chose to EXCLUDE it because it could be free text (recorded `unsure`).
- Subscriptions / SUBSCRIBED: a TRUE/FALSE flag, no risk.
- HEAT_Surveys / PLAYER_ANSWER: an enumerated rating, one character, numeric, no free text.
- HEAT_Surveys / QUESTION_ID: a numeric survey-question object id, no risk.
- HEAT_Surveys / PROFILE_ID and BATTLE_ID: identify a profile and a battle (record identity); none of the five flags, excluded by rules (a) and (b).
- HEAT_Surveys / SKIPPED_BY_PLAYER: a flag, no risk.
- Account_Name_History / OLD_NAME and NEW_NAME: past nicknames, allowed by rule (c) in this file only. Recorded `no` for person name because the user admitted them as nicknames.
- Account_Name_History / IP and External_Services_History / IP: address yes, excluded by rule (d).
- External_Services_History / UID: contains an at-sign, so email yes; excluded.
- External_Services_History / OPERATION: enumeration. NAME: a lower-case service token. Both no risk.
- Language_And_Country_History / OPERATION, NAME, VALUE: no risk. VALUE is a two-letter code.
- Every date column: a timestamp pattern, no risk on any of the five.

### Language and country

One row per setting. `NAME` says which of language or country `VALUE` holds, so
`VALUE` is both the language column and the country column and `NAME` is the
discriminator. Names only: no value of either column is recorded here.

### Date shapes (per file and column)

Every date column in every captured file uses `YYYY-MM-DD HH:MM:SS.mmm`
(millisecond precision, space separator, no timezone):

- Authorized_Third_Parties.CREATED_AT
- Bans.STARTED_AT
- Bans.EXPIRED_AT (same shape, or the null marker `\N` when unset, meaning an open ban)
- Bonus_Code_Usage.CREATED_AT
- Personal_Coupons.INSERTED_AT, UPDATED_AT and EXPIRED_AT
- HEAT_Surveys.MESSAGE_TS
- Account_Name_History.CREATED_AT, External_Services_History.CREATED_AT and Language_And_Country_History.CREATED_AT

`Subscriptions.SUBSCRIBED` is NOT a date: it is a TRUE/FALSE flag (kind text).
Subscriptions has no date column.

### Other statements

- `HEAT_Surveys.PLAYER_ANSWER` is an enumerated rating (rule h satisfied, so it is allowed).
- Exact duplicate rows: the user does not know in general. The scan found exact duplicate rows in Subscriptions (one) and Personal_Coupons (one). Recorded answer: yes. Treat every file as possibly holding exact duplicate rows within one account.

### Machine-readable record

Identical in content to `COLUMN_RISK_ANSWERS`, `PANE_MAPPING` and `DATE_SHAPES` in
`tests/fixtures/new-data-headers.ts` (the constants are the transcription of this
block).

```json
{
  "columnRiskAnswers": {
    "authorized_third_parties.csv": {
      "THIRD_PARTY_SITE": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "CREATED_AT": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"}
    },
    "bans.csv": {
      "DESCRIPTION": {"email":"no","personName":"no","freeText":"yes","ip":"no","code":"no"},
      "STARTED_AT": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "EXPIRED_AT": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "REASON": {"email":"no","personName":"no","freeText":"yes","ip":"no","code":"no"},
      "STATUS": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"}
    },
    "bonus_code_usage.csv": {
      "CREATED_AT": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "CODE_KEY": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"yes"},
      "USER_IP": {"email":"no","personName":"no","freeText":"no","ip":"yes","code":"no"}
    },
    "personal_coupons.csv": {
      "INSERTED_AT": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "UPDATED_AT": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "EXPIRED_AT": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "STATUS": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "CODE": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"yes"},
      "PREREQUISITE": {"email":"no","personName":"no","freeText":"yes","ip":"no","code":"no"}
    },
    "subscriptions.csv": {
      "SUBSCRIPTION": {"email":"no","personName":"no","freeText":"unsure","ip":"no","code":"no"},
      "SUBSCRIBED": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"}
    },
    "heat_surveys.csv": {
      "PROFILE_ID": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "BATTLE_ID": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "QUESTION_ID": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "PLAYER_ANSWER": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "SKIPPED_BY_PLAYER": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "MESSAGE_TS": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"}
    },
    "account_name_history.csv": {
      "CREATED_AT": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "IP": {"email":"no","personName":"no","freeText":"no","ip":"yes","code":"no"},
      "OLD_NAME": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "NEW_NAME": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"}
    },
    "external_services_history.csv": {
      "CREATED_AT": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "IP": {"email":"no","personName":"no","freeText":"no","ip":"yes","code":"no"},
      "OPERATION": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "NAME": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "UID": {"email":"yes","personName":"no","freeText":"no","ip":"no","code":"no"}
    },
    "language_and_country_history.csv": {
      "CREATED_AT": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "OPERATION": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "NAME": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"},
      "VALUE": {"email":"no","personName":"no","freeText":"no","ip":"no","code":"no"}
    }
  },
  "paneMapping": [
    {"primary":"OLD_NAME","secondary":["NEW_NAME"],"language":null,"country":null,"date":"CREATED_AT","discriminator":null,"folder":"User_Info","fileKey":"account_name_history.csv","pane":"timeline","cardOrKind":"Name","status":"mapped"},
    {"primary":"OPERATION","secondary":["NAME"],"language":null,"country":null,"date":"CREATED_AT","discriminator":null,"folder":"User_Info","fileKey":"external_services_history.csv","pane":"timeline","cardOrKind":"Service","status":"mapped"},
    {"primary":"OPERATION","secondary":["NAME","VALUE"],"language":"VALUE","country":"VALUE","date":"CREATED_AT","discriminator":"NAME","folder":"User_Info","fileKey":"language_and_country_history.csv","pane":"timeline","cardOrKind":"Language and country","status":"mapped"},
    {"primary":"STATUS","secondary":[],"language":null,"country":null,"date":"STARTED_AT","discriminator":null,"folder":"Bans","fileKey":"bans.csv","pane":"timeline","cardOrKind":"Ban","status":"mapped"},
    {"primary":"THIRD_PARTY_SITE","secondary":[],"language":null,"country":null,"date":"CREATED_AT","discriminator":null,"folder":"Authorized_Third_Parties","fileKey":"authorized_third_parties.csv","pane":"timeline","cardOrKind":"Third party","status":"mapped"},
    {"primary":"SUBSCRIBED","secondary":[],"language":null,"country":null,"date":null,"discriminator":null,"folder":"Subscriptions","fileKey":"subscriptions.csv","pane":"perks","cardOrKind":"Subscriptions","status":"mapped"},
    {"primary":"STATUS","secondary":["CODE"],"language":null,"country":null,"date":"INSERTED_AT","discriminator":null,"folder":"Personal_Coupons","fileKey":"personal_coupons.csv","pane":"perks","cardOrKind":"Personal coupons","status":"mapped"},
    {"primary":"CODE_KEY","secondary":["USER_IP"],"language":null,"country":null,"date":"CREATED_AT","discriminator":null,"folder":"Bonus_Codes","fileKey":"bonus_code_usage.csv","pane":"perks","cardOrKind":"Bonus codes","status":"mapped"},
    {"primary":"QUESTION_ID","secondary":["PLAYER_ANSWER","SKIPPED_BY_PLAYER"],"language":null,"country":null,"date":"MESSAGE_TS","discriminator":null,"folder":"Surveys","fileKey":"heat_surveys.csv","pane":"perks","cardOrKind":"Surveys","status":"mapped"}
  ],
  "dateShapes": [
    {"fileKey":"account_name_history.csv","column":"CREATED_AT","shape":"YYYY-MM-DD HH:MM:SS.mmm"},
    {"fileKey":"external_services_history.csv","column":"CREATED_AT","shape":"YYYY-MM-DD HH:MM:SS.mmm"},
    {"fileKey":"language_and_country_history.csv","column":"CREATED_AT","shape":"YYYY-MM-DD HH:MM:SS.mmm"},
    {"fileKey":"bans.csv","column":"STARTED_AT","shape":"YYYY-MM-DD HH:MM:SS.mmm"},
    {"fileKey":"bans.csv","column":"EXPIRED_AT","shape":"YYYY-MM-DD HH:MM:SS.mmm, or the null marker when unset"},
    {"fileKey":"authorized_third_parties.csv","column":"CREATED_AT","shape":"YYYY-MM-DD HH:MM:SS.mmm"},
    {"fileKey":"personal_coupons.csv","column":"INSERTED_AT","shape":"YYYY-MM-DD HH:MM:SS.mmm"},
    {"fileKey":"personal_coupons.csv","column":"UPDATED_AT","shape":"YYYY-MM-DD HH:MM:SS.mmm"},
    {"fileKey":"personal_coupons.csv","column":"EXPIRED_AT","shape":"YYYY-MM-DD HH:MM:SS.mmm"},
    {"fileKey":"bonus_code_usage.csv","column":"CREATED_AT","shape":"YYYY-MM-DD HH:MM:SS.mmm"},
    {"fileKey":"heat_surveys.csv","column":"MESSAGE_TS","shape":"YYYY-MM-DD HH:MM:SS.mmm"}
  ]
}
```

## Per-file column decision tables

### Authorized_Third_Parties.csv (Authorized_Third_Parties, ACCT-B)

| Header | Decision | Kind | Role | Reason |
|---|---|---|---|---|
| THIRD_PARTY_SITE | allow | text | primary | A site name only; the user rated it no risk. |
| CREATED_AT | allow | date | date | Timestamp when the third party was authorized. |

### Bans.csv (Bans, ACCT-B)

| Header | Decision | Kind | Role | Reason |
|---|---|---|---|---|
| DESCRIPTION | exclude | text | none | Free text (rule g). |
| STARTED_AT | allow | date | date | Timestamp when the ban began. |
| EXPIRED_AT | allow | date | none | Second date column, so no role under the deterministic assignment. May hold the null marker for an open ban. |
| REASON | exclude | text | none | Free text, up to 190 characters (rule g). |
| STATUS | allow | text | primary | Enumeration, no risk. |

### Bonus_Code_Usage.csv (Bonus_Codes, ACCT-A and ACCT-B)

| Header | Decision | Kind | Role | Reason |
|---|---|---|---|---|
| CREATED_AT | allow | date | date | Timestamp when the code was used. |
| CODE_KEY | allow | code | primary | A bonus code, admitted by rule (e) in this file. |
| USER_IP | allow | address | secondary | An IP address, admitted by rule (d) in this file. |

### Personal_Coupons.csv (Personal_Coupons, ACCT-B)

| Header | Decision | Kind | Role | Reason |
|---|---|---|---|---|
| INSERTED_AT | allow | date | date | Timestamp when the coupon was inserted. |
| UPDATED_AT | allow | date | none | Second date column, no role. |
| EXPIRED_AT | allow | date | none | Third date column, no role. |
| STATUS | allow | text | primary | Enumeration, no risk. |
| CODE | allow | code | secondary | A coupon code, admitted by rule (e) in this file. |
| PREREQUISITE | exclude | text | none | Free text, up to about 10k characters (rule g). |

### Subscriptions.csv (Subscriptions, ACCT-B and ACCT-C)

| Header | Decision | Kind | Role | Reason |
|---|---|---|---|---|
| SUBSCRIPTION | exclude | text | none | The user chose to exclude it: it could be free text (recorded unsure, rule g). |
| SUBSCRIBED | allow | text | primary | A TRUE/FALSE flag (rule f). The only allowed column, so it is the primary. |

### HEAT_Surveys.csv (Surveys, ACCT-B)

| Header | Decision | Kind | Role | Reason |
|---|---|---|---|---|
| PROFILE_ID | exclude | number | none | Identifies the profile, not a game object (rules a and b). |
| BATTLE_ID | exclude | number | none | Identifies the battle record (rule b). |
| QUESTION_ID | allow | number | primary | Names a survey-question object (rule b), numeric. |
| PLAYER_ANSWER | allow | text | secondary | The user states it is an enumerated rating, one character, no free text (rule h). |
| SKIPPED_BY_PLAYER | allow | text | secondary | A flag (rule f). |
| MESSAGE_TS | allow | date | date | Timestamp of the survey message. |

### Account_Name_History.csv (User_Info, ACCT-B)

| Header | Decision | Kind | Role | Reason |
|---|---|---|---|---|
| CREATED_AT | allow | date | date | Timestamp of the rename. |
| IP | exclude | address | none | IP is admitted only in Bans, Authorized_Third_Parties and Bonus_Codes (rule d). |
| OLD_NAME | allow | text | primary | A past nickname, admitted by rule (c) in this file only. |
| NEW_NAME | allow | text | secondary | A past nickname, admitted by rule (c) in this file only. |

### External_Services_History.csv (User_Info, ACCT-B and ACCT-C)

| Header | Decision | Kind | Role | Reason |
|---|---|---|---|---|
| CREATED_AT | allow | date | date | Timestamp of the operation. |
| IP | exclude | address | none | Rule (d). |
| OPERATION | allow | text | primary | Enumeration, no risk. |
| NAME | allow | text | secondary | A lower-case service token, no risk. |
| UID | exclude | text | none | Contains an at-sign: email-bearing (rules a and g). |

### Language_And_Country_History.csv (User_Info, ACCT-B and ACCT-C)

| Header | Decision | Kind | Role | Reason |
|---|---|---|---|---|
| CREATED_AT | allow | date | date | Timestamp of the change. |
| OPERATION | allow | text | primary | No risk. |
| NAME | allow | text | secondary | No risk; discriminates whether VALUE holds a language or a country. |
| VALUE | allow | text | secondary, language, country | A two-letter code; holds a language when NAME says language and a country when NAME says country. |

## Pane mapping

Exactly one file feeds each Perks card and each timeline kind. Every row below
passed the completeness gate (see the end of this section). `status` is `mapped` for
all nine; none was removed.

| Folder | File key | Pane | Card or kind | Date | Primary | Secondary | Language | Country |
|---|---|---|---|---|---|---|---|---|
| User_Info | account_name_history.csv | Account timeline | Name | CREATED_AT | OLD_NAME | NEW_NAME | none | none |
| User_Info | external_services_history.csv | Account timeline | Service | CREATED_AT | OPERATION | NAME | none | none |
| User_Info | language_and_country_history.csv | Account timeline | Language and country | CREATED_AT | OPERATION | NAME, VALUE | VALUE (when NAME says language) | VALUE (when NAME says country) |
| Bans | bans.csv | Account timeline | Ban | STARTED_AT | STATUS | none | none | none |
| Authorized_Third_Parties | authorized_third_parties.csv | Account timeline | Third party | CREATED_AT | THIRD_PARTY_SITE | none | none | none |
| Subscriptions | subscriptions.csv | Perks | Subscriptions | none | SUBSCRIBED | none | none | none |
| Personal_Coupons | personal_coupons.csv | Perks | Personal coupons | INSERTED_AT | STATUS | CODE | none | none |
| Bonus_Codes | bonus_code_usage.csv | Perks | Bonus codes | CREATED_AT | CODE_KEY | USER_IP | none | none |
| Surveys | heat_surveys.csv | Perks | Surveys | MESSAGE_TS | QUESTION_ID | PLAYER_ANSWER, SKIPPED_BY_PLAYER | none | none |

Language and country discriminator: the `NAME` column says which of language or
country `VALUE` holds on each row.

Files the capture shows that no pane uses: none. The only `User_Info` files printed
are the three named history files; `Account_Info.csv` and `Game_Forums` are out of
scope by design and never captured.

### Completeness gate

Run after the mapping was written. Every mapped timeline row has a primary column;
the Language and country row has a language and a country column (`VALUE`); every
mapped Perks row has a file key and a primary column; every column named in the
table is an `allow` row of its table. Result: all nine rows pass, none removed.

One row passes only narrowly and is flagged for review: **Subscriptions** has a
single allowed column, the TRUE/FALSE flag `SUBSCRIBED`, because the user excluded
`SUBSCRIPTION` as possible free text. The deterministic rule makes the flag the
primary, so the row passes. A card built on it can show only whether each row is
subscribed, not what it is subscribed to. If that is not worth a card, the decision
is to set its status to removed (a first-class outcome plans 12-10, 12-11 and 12-13
derive their counts from), or to allow `SUBSCRIPTION` after the user reviews it. No
value was invented.

## Notes

- **Delimiter:** every captured file uses a comma.
- **Files per account:** ACCT-A holds Bonus_Code_Usage.csv. ACCT-B holds all nine files (including HEAT_Surveys.csv). ACCT-C holds Subscriptions.csv, External_Services_History.csv and Language_And_Country_History.csv. ACCT-B and ACCT-C report the same size and line count for those three files.
- **Headers that differ between accounts:** none. Bonus_Code_Usage.csv (ACCT-A, ACCT-B), Subscriptions.csv, External_Services_History.csv and Language_And_Country_History.csv (ACCT-B, ACCT-C) agree exactly.
- **Other files in User_Info:** none beyond the three named history files.
- **Suppressed or not-captured headers:** none; every HDR line printed names.
- **Duplicates:** treat every file as possibly holding exact duplicate rows within one account (see Other statements).
- **Subscriptions is flag-only** (see the completeness gate).
- **Roles follow the deterministic rule**, not display preference: for example, Name's primary is OLD_NAME and its secondary NEW_NAME, Service's primary is OPERATION and its secondary NAME, and Personal coupons' primary is STATUS with CODE secondary. A pane may present them in another order; the allow set does not change.

### Date shapes

Every timeline and Perks date column is the single shape `YYYY-MM-DD HH:MM:SS.mmm`.
Each is one of the four shapes the instant parser reads (ISO date-time with a space
separator, seconds and a fraction, no trailing Z), so no shape is flagged and plan
12-11 needs no parser widening for them:

- account_name_history.csv / CREATED_AT: `YYYY-MM-DD HH:MM:SS.mmm`, parser shape 1.
- external_services_history.csv / CREATED_AT: same, parser shape 1.
- language_and_country_history.csv / CREATED_AT: same, parser shape 1.
- bans.csv / STARTED_AT: same, parser shape 1.
- bans.csv / EXPIRED_AT: same, parser shape 1, or the null marker `\N` for an open ban. **Flagged:** the null marker is not a date and must read as "no end date, open", never as an invalid or undated row. Plan 12-11 handles it explicitly.
- authorized_third_parties.csv / CREATED_AT: same, parser shape 1.
- personal_coupons.csv / INSERTED_AT, UPDATED_AT, EXPIRED_AT: same, parser shape 1.
- bonus_code_usage.csv / CREATED_AT: same, parser shape 1.
- heat_surveys.csv / MESSAGE_TS: same, parser shape 1.
