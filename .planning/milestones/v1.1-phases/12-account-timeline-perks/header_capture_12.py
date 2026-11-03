#!/usr/bin/env python3
"""header_capture_12.py -- print column HEADERS from a Wargaming export zip, never values.

Usage:
    python3 -I header_capture_12.py <path-to-export.zip>

WHY THIS EXISTS
Phase 12 needs the real column names of eight unverified record families (the
account/timeline/perks families of D-01 and PRIV-01) before any allowlist can be
written, and the research session could not read them: the permission classifier
denied every attempt to open an entry's content AND a directory listing
(CONTEXT D-04). The user therefore runs THIS SCRIPT, on their own machine, on
their own zip.

WHAT IT GUARANTEES
* It opens the archive read-only, extracts NOTHING to disk, and imports nothing
  outside the standard library. It reads each entry's bytes for two purposes
  only: to count its non-empty lines and to take its FIRST line. It prints
  nothing it has not proven identifier-only.
* It prints, per in-scope file: the path (account folders relabelled ACCT-A,
  ACCT-B, ...), the byte size, the non-empty line count, the delimiter, and the
  first line ONLY when every one of its tokens is identifier-like AND none of
  them is code-shaped.
* Account_Info.csv and anything under Game_Forums are NEVER in scope, so
  neither their paths nor their headers can be printed (D-02, D-04).

TWO GUARDS, NOT ONE
Phase 11 needed one: a data cell is never identifier-like. Phase 12 does not,
because the export contains headerless ONE-COLUMN files whose single cell is a
coupon code or a bonus code (`AB7KQX42` is a perfectly good identifier token).
So a first line is printed only when BOTH hold:
  1. every token matches `^[A-Za-z][A-Za-z0-9_]{0,63}$` (Phase 11's rule), and
  2. no token is code-shaped -- at least six characters, letters and digits
     only (no underscore), containing both a letter and a digit; and the file is
     not a single-token file of fewer than two non-empty lines.
A real header here is UPPER_SNAKE words, so neither guard touches one. A
legitimate header that trips them prints `HDR [suppressed]` and the user reads
that file by hand -- failing closed is the correct direction.

OUTPUT CONTRACT (parsed by plan 12-01 Task 3)
    FILE <relative path> bytes <n> nonempty_lines <n>
    DELIM <; or , or [none]>
    HDR <TOKEN>|<TOKEN>|...        (or `HDR [suppressed]`)

The behaviour is pinned by tests/unit/guards/header-capture-script-12.test.ts,
which runs this script over a synthetic archive that plants canaries.
"""

import re
import sys
import zipfile

# A token is identifier-like when it is a letter followed by up to 63 letters,
# digits or underscores -- so no token can exceed 64 characters.
TOKEN_RE = re.compile(r'^[A-Za-z][A-Za-z0-9_]{0,63}$')

# Code-shaped: mixed letters and digits, six or more characters, no underscore.
# A real column name is UPPER_SNAKE and has no digit; this cannot match one.
CODE_SHAPE_RE = re.compile(r'^(?=.*[0-9])(?=.*[A-Za-z])[A-Za-z0-9]{6,}$')

# A top-level folder of four or more digits is an account number.
ACCOUNT_ROOT_RE = re.compile(r'^[0-9]{4,}$')

# CRLF, LF and bare CR all terminate a record (the export mixes all three).
LINE_SPLIT_RE = re.compile(r'\r\n|\n|\r')

# Scope is by FOLDER, not by file name: the file names inside Bans,
# Authorized_Third_Parties, Personal_Coupons and Bonus_Codes are unknown, so a
# name-based filter would miss them. The folder is the second path segment,
# lower-cased. Every `.csv` in these six is in scope.
PROMOTED_FOLDERS = frozenset([
    'authorized_third_parties',
    'bans',
    'bonus_codes',
    'personal_coupons',
    'subscriptions',
    'surveys',
])

# Inside user_info only history files are in scope. The three named ones are the
# record families this phase needs; a fourth name containing the word "history"
# is admitted by the same rule so the user's real export cannot silently lose a
# family this phase was planned around. Account_Info.csv is NOT one of them
# (its header carries LOGIN and BIRTH_DATE) and is never in scope.
USER_INFO_FOLDER = 'user_info'
NAMED_HISTORY_FILES = frozenset([
    'account_name_history.csv',
    'external_services_history.csv',
    'language_and_country_history.csv',
])

BOM = '\ufeff'
SUPPRESSED = '[suppressed]'
ACCOUNT_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'


def detect_delimiter(line):
    """Return ';' or ',' from the first line, or None when it carries neither."""
    semicolons = line.count(';')
    commas = line.count(',')
    if semicolons and semicolons >= commas:
        return ';'
    if commas:
        return ','
    return None


def header_tokens(first_line, delimiter):
    """Header tokens in file order, or None when the line is not identifier-only."""
    if not first_line:
        return None
    fields = first_line.split(delimiter) if delimiter else [first_line]
    tokens = []
    for raw_field in fields:
        token = raw_field.strip()
        # At most one pair of double quotes, then surrounding spaces again: the
        # export's payments-era files are quote-all.
        if len(token) >= 2 and token[0] == '"' and token[-1] == '"':
            token = token[1:-1].strip()
        if not TOKEN_RE.match(token):
            return None
        tokens.append(token)
    return tokens or None


def safe_header_tokens(first_line, delimiter, non_empty_lines):
    """Tokens safe to print, or None when ANY guard rejects the first line.

    Three rejections, each closing a different leak:
      * a non identifier-only token    -- a data row, an email, an address;
      * a code-shaped token            -- a coupon or bonus code in a
                                          headerless one-column file, which IS
                                          identifier-like and would otherwise
                                          print verbatim (T-12-01);
      * a single-token file of fewer
        than two non-empty lines       -- the same cell, by shape rather than
                                          by content, so a code the guards
                                          happen not to recognise is still
                                          never printed.
    """
    tokens = header_tokens(first_line, delimiter)
    if not tokens:
        return None
    if any(CODE_SHAPE_RE.match(token) for token in tokens):
        return None
    if non_empty_lines < 2 and len(tokens) == 1:
        return None
    return tokens


def in_scope(parts):
    """True when this archive path is one this phase may read at all."""
    if len(parts) < 3:
        return False
    folder = parts[1].lower()
    file_name = parts[-1].lower()
    if folder in PROMOTED_FOLDERS:
        return file_name.endswith('.csv')
    if folder == USER_INFO_FOLDER:
        return file_name in NAMED_HISTORY_FILES or 'history' in file_name
    # Everything else -- Game_Forums included -- stores nothing (D-02).
    return False


def account_labels(entry_names):
    """Map each numeric top-level folder to ACCT-A, ACCT-B, ... in sorted order.

    The digits themselves are never returned, so no caller can print them.
    """
    roots = set()
    for name in entry_names:
        root = name.split('/')[0]
        if ACCOUNT_ROOT_RE.match(root):
            roots.add(root)
    ordered = sorted(roots, key=lambda root: (len(root), root))
    return {
        root: 'ACCT-' + (ACCOUNT_LABELS[n] if n < len(ACCOUNT_LABELS) else '%02d' % (n + 1))
        for n, root in enumerate(ordered)
    }


def main(argv):
    if len(argv) != 2:
        sys.stderr.write('usage: python3 -I header_capture_12.py <path-to-export.zip>\n')
        return 2

    with zipfile.ZipFile(argv[1]) as archive:
        entries = [info for info in archive.infolist() if not info.is_dir()]
        labels = account_labels(info.filename for info in entries)

        for info in entries:
            parts = info.filename.split('/')
            if not in_scope(parts):
                continue

            text = archive.read(info).decode('utf-8', errors='replace')
            lines = [line for line in LINE_SPLIT_RE.split(text) if line.strip()]
            first_line = lines[0].lstrip(BOM) if lines else ''  # strip BOM
            delimiter = detect_delimiter(first_line)
            tokens = safe_header_tokens(first_line, delimiter, len(lines))

            shown = [labels.get(parts[0], parts[0])] + parts[1:]
            print('FILE', '/'.join(shown), 'bytes', info.file_size, 'nonempty_lines', len(lines))
            print('DELIM', delimiter if delimiter else '[none]')
            print('HDR', '|'.join(tokens) if tokens else SUPPRESSED)

    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))