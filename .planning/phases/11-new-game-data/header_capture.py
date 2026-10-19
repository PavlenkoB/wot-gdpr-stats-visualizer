#!/usr/bin/env python3
"""header_capture.py -- print column HEADERS from a Wargaming export zip, never values.

Usage:
    python3 -I header_capture.py <path-to-export.zip>

WHY THIS EXISTS
Phase 11 needs the real column names of the HEAT, WOTC, WOWP and WoWS crews /
storage files before the per-file allowlists of D-08 can be written, and the
research session could not read them: the permission classifier denied every
attempt to open an entry's content (CONTEXT D-10, D-12). The user therefore runs
THIS SCRIPT, on their own machine, on their own zip.

WHAT IT GUARANTEES
* It opens the archive read-only, extracts nothing to disk, and imports nothing
  outside the standard library.
* It prints, per in-scope file: the path (account folders relabelled ACCT-A,
  ACCT-B, ...), the byte size, the non-empty line count, the delimiter, and the
  first line ONLY when every one of its tokens is identifier-like.
* A first line that is a data row -- digits, an address, spaces, a dot -- makes
  the WHOLE line print as `[suppressed]`. Nothing of it is printed anywhere.
* No cell value, nickname, email or account number is ever printed.

The behaviour is pinned by tests/unit/guards/header-capture-script.test.ts,
which runs this script over a synthetic archive that plants canaries.

OUTPUT CONTRACT (parsed by plan 11-02 Task 3)
    FILE <relative path> bytes <n> nonempty_lines <n>
    DELIM <; or , or [none]>
    HDR <TOKEN>|<TOKEN>|...        (or `HDR [suppressed]`)

WHY THERE IS NO TOKEN-COUNT CEILING
A header line wider than 80 fields is legitimate in this export (the account
storage file is the widest at ~4 KB), and suppressing it would fail closed for
no safety gain: the identifier-only rule above is the leak guard, since a data
cell is never identifier-like. The 80-token bound is asserted on the synthetic
archive's output by the guard test instead of being enforced here.
"""

import re
import sys
import zipfile

# A token is identifier-like when it is a letter followed by up to 63 letters,
# digits or underscores -- so no token can exceed 64 characters. The research
# session's draft also admitted digits-only tokens, which would have printed a
# numeric first line verbatim; that is the exact leak this tightened.
TOKEN_RE = re.compile(r'^[A-Za-z][A-Za-z0-9_]{0,63}$')

# In scope: the HEAT, WOTC and WOWP families, plus the two Warships files whose
# names do not carry a family prefix. Matched against the FILE NAME only, so a
# folder name can never pull a file into scope.
FAMILY_RE = re.compile(r'(HEAT_|WOTC_|WOWP_|WOWS_Crews|WOWS_Account_Storage)', re.IGNORECASE)

# A top-level folder of four or more digits is an account number.
ACCOUNT_ROOT_RE = re.compile(r'^[0-9]{4,}$')

# CRLF, LF and bare CR all terminate a record (the export mixes all three).
LINE_SPLIT_RE = re.compile(r'\r\n|\n|\r')

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
        sys.stderr.write('usage: python3 -I header_capture.py <path-to-export.zip>\n')
        return 2

    with zipfile.ZipFile(argv[1]) as archive:
        entries = [info for info in archive.infolist() if not info.is_dir()]
        labels = account_labels(info.filename for info in entries)

        for info in entries:
            parts = info.filename.split('/')
            if not FAMILY_RE.search(parts[-1]):
                continue

            text = archive.read(info).decode('utf-8', errors='replace')
            lines = [line for line in LINE_SPLIT_RE.split(text) if line.strip()]
            first_line = lines[0].lstrip(BOM) if lines else ''  # strip BOM
            delimiter = detect_delimiter(first_line)
            tokens = header_tokens(first_line, delimiter)

            shown = [labels.get(parts[0], parts[0])] + parts[1:]
            print('FILE', '/'.join(shown), 'bytes', info.file_size, 'nonempty_lines', len(lines))
            print('DELIM', delimiter if delimiter else '[none]')
            print('HDR', '|'.join(tokens) if tokens else SUPPRESSED)

    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))