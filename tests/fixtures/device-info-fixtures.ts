import { renderQuoteAllCsv } from './finance-fixtures.ts';

// =============================================================================
// device-info-fixtures.ts — the three Device_info files, written by hand
// (quick task 261012-bog)
// =============================================================================
//
// WHY THIS MODULE EXISTS
//   The export's `Device_info` folder holds three files the viewer now reads:
//   `WOT_Device_Info.csv` (PC hardware, ten columns), `WOTB_Device_Info.csv`
//   (Blitz devices, eight columns) and `WOT_Assistant_Device_Info.csv` (a single
//   `POST` column whose cells are JSON-like blobs). The sample export carries
//   them so every sample-driven spec covers the pane for free.
//
// EVERY VALUE IS FABRICATED
//   Strings are `Synth`-prefixed and numbers are unmistakable synthetic ones.
//   Nothing here is copied from a real export, and none of it may ever be.
//
// THE TWO CANARIES
//   `DEVICE_SPA_CANARY` stands for the account id the blob carries (the "Spa
//   id") and `DEVICE_FLAGS_CANARY` for the opaque PC-configuration flags value.
//   Both are fabricated strings that equal nothing else in the sample, the
//   account root and the nickname included. Each readable blob carries both, so
//   a leak anywhere (a stored row, a posted view, the DOM) is a string match.
//
// THE PHYSICAL SHAPE IS THE REAL ONE
//   Bare header, quote-all data cells, a bare CR after every line, written by
//   `renderQuoteAllCsv` (the one writer for that shape; never a second one).
//   The Assistant file is rendered TWICE because the parser has two paths:
//     - LF inside the quoted cells with a bare-CR record terminator: a MIXED
//       file, so every CR becomes LF and the cells keep their inner LF;
//     - every inner LF replaced by CR: a UNIFORM bare-CR file, whose quoted
//       cells hold CRs.
//   The shared sample uses the first.
// =============================================================================

/** The account id the Assistant blob carries. Must never be stored or shown. */
export const DEVICE_SPA_CANARY = 'SynthSpaCanary-7f3a91c2';

/** The opaque PC-configuration flags value. Must never be stored or shown. */
export const DEVICE_FLAGS_CANARY = 'SynthFlagsCanary-5524481';

// -----------------------------------------------------------------------------
// Headers (PD-10)
// -----------------------------------------------------------------------------

/** The ten PC columns, in file order. */
export const DEVICE_PC_HEADER: readonly string[] = [
  'PC_TYPE',
  'OS',
  'OS_BIT',
  'CPU_VENDOR',
  'CPU_NAME',
  'CPU_CORES',
  'GPU_VENDOR',
  'GPUMEMORY',
  'MAINMEMORY',
  'MULTI_GPU',
];

/** The eight Blitz columns, in file order. */
export const DEVICE_BLITZ_HEADER: readonly string[] = [
  'PLATFORM_NAME',
  'VENDOR_NAME',
  'MODEL_NAME',
  'OS',
  'REGION',
  'SHOP_NAME',
  'COUNTRY_BY_IP',
  'COUNTRY_BY_TZ',
];

/** The Assistant file's single column. */
export const DEVICE_ASSISTANT_HEADER: readonly string[] = ['POST'];

// -----------------------------------------------------------------------------
// PC rows (four)
// -----------------------------------------------------------------------------
//
// Memory cells are MB: 4096 -> 4 GB, 1536 -> 1.5 GB, 3000 -> 2.9 GB (2.93
// rounds to one decimal). Row 3 holds an `N/D` memory cell and a non-numeric
// one; rows 2 and 3 hold an upper-case and a lower-case `n/d` elsewhere, and
// row 3 a blank cell.

export const DEVICE_PC_ROWS: readonly (readonly string[])[] = [
  [
    'SynthDesktop',
    'SynthOS 10',
    '64',
    'SynthCpuCo',
    'SynthCore 4000',
    '8',
    'SynthGpuCo',
    '4096',
    '3000',
    '0',
  ],
  [
    'SynthLaptop',
    'N/D',
    '64',
    'SynthCpuCo',
    'SynthCore 2000',
    '4',
    'SynthGpuCo',
    '1536',
    '4096',
    '1',
  ],
  [
    'SynthTablet',
    'SynthOS 9',
    'n/d',
    '',
    'SynthCore 1000',
    '2',
    'SynthGpuCo',
    'N/D',
    'about three SynthGB',
    '0',
  ],
  [
    'SynthWorkstation',
    'SynthOS 11',
    '64',
    'SynthCpuCo',
    'SynthCore 9000',
    '16',
    'SynthGpuCo',
    '3000',
    '1536',
    '0',
  ],
];

/**
 * The cells the pane must show for the four PC rows: memory columns as numbers
 * (MB) when all digits and as the written text otherwise, N/D in any case and
 * a blank cell as null.
 */
export const DEVICE_PC_EXPECTED_CELLS: readonly (readonly (string | number | null)[])[] = [
  [
    'SynthDesktop',
    'SynthOS 10',
    '64',
    'SynthCpuCo',
    'SynthCore 4000',
    '8',
    'SynthGpuCo',
    4096,
    3000,
    '0',
  ],
  ['SynthLaptop', null, '64', 'SynthCpuCo', 'SynthCore 2000', '4', 'SynthGpuCo', 1536, 4096, '1'],
  [
    'SynthTablet',
    'SynthOS 9',
    null,
    null,
    'SynthCore 1000',
    '2',
    'SynthGpuCo',
    null,
    'about three SynthGB',
    '0',
  ],
  [
    'SynthWorkstation',
    'SynthOS 11',
    '64',
    'SynthCpuCo',
    'SynthCore 9000',
    '16',
    'SynthGpuCo',
    3000,
    1536,
    '0',
  ],
];

// -----------------------------------------------------------------------------
// Blitz rows (three)
// -----------------------------------------------------------------------------

export const DEVICE_BLITZ_ROWS: readonly (readonly string[])[] = [
  [
    'SynthBlitzPhone',
    'SynthVendorA',
    'SynthModel X1',
    'SynthMobileOS 14',
    'SynthRegion',
    'SynthShop',
    'ZZ',
    'ZY',
  ],
  ['SynthBlitzTablet', 'SynthVendorB', '', 'SynthMobileOS 12', 'N/D', 'SynthShop', 'ZZ', 'ZZ'],
  [
    'SynthBlitzPad',
    'SynthVendorC',
    'SynthModel P3',
    'SynthMobileOS 15',
    'SynthRegion',
    'n/d',
    'ZY',
    'ZY',
  ],
];

/** The Blitz cells the pane must show (blank and N/D in any case are null). */
export const DEVICE_BLITZ_EXPECTED_CELLS: readonly (readonly (string | null)[])[] = [
  [
    'SynthBlitzPhone',
    'SynthVendorA',
    'SynthModel X1',
    'SynthMobileOS 14',
    'SynthRegion',
    'SynthShop',
    'ZZ',
    'ZY',
  ],
  ['SynthBlitzTablet', 'SynthVendorB', null, 'SynthMobileOS 12', null, 'SynthShop', 'ZZ', 'ZZ'],
  [
    'SynthBlitzPad',
    'SynthVendorC',
    'SynthModel P3',
    'SynthMobileOS 15',
    'SynthRegion',
    null,
    'ZY',
    'ZY',
  ],
];

// -----------------------------------------------------------------------------
// Assistant blobs (eight: four readable, four not)
// -----------------------------------------------------------------------------

/** One blob and what the extractor must make of it. */
export interface DeviceBlobFixture {
  /** The blob text exactly as the cell holds it (inner line breaks are LF). */
  blob: string;
  /** The four readable fields in column order, or null when unreadable. */
  expected: readonly [string | null, string | null, string | null, string | null] | null;
  /** The derivation, kept beside the value so the expectation is checkable. */
  note: string;
}

const PRETTY = (entries: readonly string[], trailingComma = false): string =>
  `{\n${entries.map((e) => `  ${e}`).join(',\n')}${trailingComma ? ',' : ''}\n}`;

export const DEVICE_BLOBS: readonly DeviceBlobFixture[] = [
  {
    // Pretty multi-line JSON: the real shape. Fields in the order the real
    // blob lists them, the Spa id and the flags between and after.
    blob: PRETTY([
      '"Device type": "SynthPhone"',
      '"App": "SynthAssistant"',
      `"Spa id": "${DEVICE_SPA_CANARY}"`,
      '"Platform": "SynthDroid"',
      '"Version": "9.9.1"',
      `"PC configuration flags": "${DEVICE_FLAGS_CANARY}"`,
    ]),
    expected: ['SynthPhone', 'SynthAssistant', 'SynthDroid', '9.9.1'],
    note: 'pretty multi-line JSON; all four fields readable',
  },
  {
    // Single line, keys in a different order; case of keys is the same.
    blob: `{"Version":"9.9.2","Platform":"SynthPad","App":"SynthAssistant","Device type":"SynthTablet","Spa id":"${DEVICE_SPA_CANARY}","PC configuration flags":"${DEVICE_FLAGS_CANARY}"}`,
    expected: ['SynthTablet', 'SynthAssistant', 'SynthPad', '9.9.2'],
    note: 'single-line JSON, keys reordered; all four fields readable',
  },
  {
    // A trailing comma makes JSON.parse reject it, so the anchored fallback
    // patterns read it. Multi-line on purpose.
    blob: PRETTY(
      [
        '"Device type": "SynthDesk"',
        '"App": "SynthAssistant"',
        `"Spa id": "${DEVICE_SPA_CANARY}"`,
        '"Platform": "SynthWin"',
        '"Version": "9.9.3"',
        `"PC configuration flags": "${DEVICE_FLAGS_CANARY}"`,
      ],
      true,
    ),
    expected: ['SynthDesk', 'SynthAssistant', 'SynthWin', '9.9.3'],
    note: 'JSON-like with a trailing comma: JSON.parse fails, the fallback patterns read it',
  },
  {
    // The Version is a JSON number: String(4.2) is "4.2".
    blob: `{"Device type":"SynthPhone","App":"SynthAssistant","Platform":"SynthDroid","Version":4.2,"Spa id":"${DEVICE_SPA_CANARY}"}`,
    expected: ['SynthPhone', 'SynthAssistant', 'SynthDroid', '4.2'],
    note: 'numeric Version: a finite number is accepted and rendered as text',
  },
  {
    // Valid JSON, none of the four keys: nothing to read.
    blob: `{"Spa id":"${DEVICE_SPA_CANARY}","PC configuration flags":"${DEVICE_FLAGS_CANARY}","Locale":"synth"}`,
    expected: null,
    note: 'valid object with none of the four keys: unreadable',
  },
  {
    // Not a blob at all, but it still mentions the canary, so a marker that
    // kept the text would leak it.
    blob: `This is plain text and not a blob. Spa id ${DEVICE_SPA_CANARY} flags ${DEVICE_FLAGS_CANARY}`,
    expected: null,
    note: 'plain text: unreadable, and the marker keeps none of it',
  },
  {
    // All four values are N/D or blank, so there is nothing to show.
    blob: `{"Device type":"N/D","App":"n/d","Platform":" ","Version":"","Spa id":"${DEVICE_SPA_CANARY}"}`,
    expected: null,
    note: 'four values all N/D or blank: unreadable',
  },
  {
    // An own `__proto__` key holding a nested object with the four keys. Only
    // allow-listed own string or number values of the TOP-LEVEL object count.
    blob: `{"__proto__":{"Device type":"SynthProto","App":"SynthProto","Platform":"SynthProto","Version":"0"},"Spa id":"${DEVICE_SPA_CANARY}"}`,
    expected: null,
    note: 'own __proto__ key with a nested object: unreadable, nothing inherited',
  },
];

/** The readable blobs' expected rows, in file order (four). */
export const DEVICE_ASSISTANT_EXPECTED_CELLS: readonly (readonly (string | null)[])[] =
  DEVICE_BLOBS.flatMap((b) => (b.expected === null ? [] : [b.expected]));

/** How many blobs cannot be read (four). */
export const DEVICE_ASSISTANT_UNREADABLE: number = DEVICE_BLOBS.filter(
  (b) => b.expected === null,
).length;

// -----------------------------------------------------------------------------
// Rendered files
// -----------------------------------------------------------------------------

export const DEVICE_PC_CSV: string = renderQuoteAllCsv(DEVICE_PC_HEADER, DEVICE_PC_ROWS);
export const DEVICE_BLITZ_CSV: string = renderQuoteAllCsv(DEVICE_BLITZ_HEADER, DEVICE_BLITZ_ROWS);

/** LF inside the quoted cells, bare CR between records: the parser's mixed path. */
export const DEVICE_ASSISTANT_CSV: string = renderQuoteAllCsv(
  DEVICE_ASSISTANT_HEADER,
  DEVICE_BLOBS.map((b) => [b.blob]),
);

/** Every inner LF replaced by CR: a uniformly bare-CR file. */
export const DEVICE_ASSISTANT_CSV_UNIFORM_CR: string = renderQuoteAllCsv(
  DEVICE_ASSISTANT_HEADER,
  DEVICE_BLOBS.map((b) => [b.blob.replaceAll('\n', '\r')]),
);

/** A header-only Assistant file: the header and no data row. */
export const DEVICE_ASSISTANT_HEADER_ONLY_CSV: string = `${DEVICE_ASSISTANT_HEADER.join(';')}\r`;

// -----------------------------------------------------------------------------
// The sample's three files and their derived counts
// -----------------------------------------------------------------------------

/** The three real file names (original capitalisation). */
export const DEVICE_FILE_NAMES = {
  pc: 'WOT_Device_Info.csv',
  blitz: 'WOTB_Device_Info.csv',
  assistant: 'WOT_Assistant_Device_Info.csv',
} as const;

/**
 * Relative path (under the account root) to file text. This is what the shared
 * sample export carries in place of the old invented `Devices.csv`.
 */
export const DEVICE_INFO_SAMPLE_FILES: Readonly<Record<string, string>> = {
  [`Device_info/${DEVICE_FILE_NAMES.pc}`]: DEVICE_PC_CSV,
  [`Device_info/${DEVICE_FILE_NAMES.blitz}`]: DEVICE_BLITZ_CSV,
  [`Device_info/${DEVICE_FILE_NAMES.assistant}`]: DEVICE_ASSISTANT_CSV,
};

/** Counts derived from the rows above, never typed. */
export const DEVICE_INFO_COUNTS = {
  files: Object.keys(DEVICE_INFO_SAMPLE_FILES).length,
  pc: DEVICE_PC_ROWS.length,
  blitz: DEVICE_BLITZ_ROWS.length,
  assistant: DEVICE_BLOBS.length,
  /** Every data row in the folder: what the category's rowCount reads. */
  total: DEVICE_PC_ROWS.length + DEVICE_BLITZ_ROWS.length + DEVICE_BLOBS.length,
  /** Assistant rows from which no field could be read. */
  unreadable: DEVICE_ASSISTANT_UNREADABLE,
} as const;
