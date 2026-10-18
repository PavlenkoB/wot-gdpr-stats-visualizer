import { describe, expect, test } from 'vitest';
import { oneAccount } from '../../helpers/row-groups';
import {
  buildDeviceInfo,
  extractAssistantFields,
  hasBlobColumn,
  isDeviceInfoCategory,
  reduceBlobRow,
} from '../../../src/lib/features/device-info/device-info-aggregate.ts';
import {
  ASSISTANT_COLUMNS,
  ASSISTANT_STORED_HEADERS,
  BLITZ_COLUMNS,
  DEVICE_COLUMN_HEADERS,
  DEVICE_FILE_KEYS,
  DEVICE_ROW_STATE_KEY,
  DEVICE_ROW_UNREADABLE,
  MAX_BLOB_LENGTH,
  MAX_DEVICE_ROWS,
  MAX_DEVICE_TEXT,
  PC_COLUMNS,
  type DeviceInfoView,
} from '../../../src/lib/features/device-info/device-info-shared.ts';
import { MAX_STORED_STRING } from '../../../src/lib/features/finance/finance-shared.ts';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse.ts';
import {
  DEVICE_ASSISTANT_CSV,
  DEVICE_ASSISTANT_CSV_UNIFORM_CR,
  DEVICE_ASSISTANT_EXPECTED_CELLS,
  DEVICE_ASSISTANT_HEADER_ONLY_CSV,
  DEVICE_ASSISTANT_UNREADABLE,
  DEVICE_BLITZ_CSV,
  DEVICE_BLITZ_EXPECTED_CELLS,
  DEVICE_BLOBS,
  DEVICE_FLAGS_CANARY,
  DEVICE_INFO_COUNTS,
  DEVICE_PC_CSV,
  DEVICE_PC_EXPECTED_CELLS,
  DEVICE_SPA_CANARY,
} from '../../fixtures/device-info-fixtures.ts';

// =============================================================================
// Quick 261012-bog Task 1 — the pure extractor and builder
// =============================================================================
//
// Everything here runs with no worker and no Dexie: the extractor and the
// builder are pure, and the fixtures are parsed with the REAL parser so the
// record boundaries are the parser's, not a test's guess.
// =============================================================================

type Row = Record<string, string | undefined>;

function parse(text: string, sourceFile: string): Row[] {
  return parseCsvFile(text, 'Device_info', sourceFile).rows.map((r) => r.data);
}

const PC_ROWS = parse(DEVICE_PC_CSV, 'WOT_Device_Info.csv');
const BLITZ_ROWS = parse(DEVICE_BLITZ_CSV, 'WOTB_Device_Info.csv');
const ASSISTANT_ROWS = parse(DEVICE_ASSISTANT_CSV, 'WOT_Assistant_Device_Info.csv');

/** The text of every value reachable in a view, keys included. */
function everything(view: unknown): string {
  return JSON.stringify(view);
}

describe('the fixture CSVs, parsed with the real parser', () => {
  test('row counts are the hand-derived ones', () => {
    expect(PC_ROWS).toHaveLength(4);
    expect(BLITZ_ROWS).toHaveLength(3);
    expect(ASSISTANT_ROWS).toHaveLength(8);
    expect(DEVICE_INFO_COUNTS.total).toBe(15);
  });

  test('both Assistant renderings keep every multi-line blob cell intact', () => {
    const uniform = parse(DEVICE_ASSISTANT_CSV_UNIFORM_CR, 'WOT_Assistant_Device_Info.csv');
    expect(uniform).toHaveLength(8);
    for (const rows of [ASSISTANT_ROWS, uniform]) {
      // The first blob is pretty multi-line: it still holds all six keys.
      const first = rows[0]!['POST']!;
      expect(first).toContain('"Device type": "SynthPhone"');
      expect(first).toContain('"Version": "9.9.1"');
      expect(first).toContain(DEVICE_SPA_CANARY);
      // Every row has the single POST key and nothing in the overflow bucket.
      for (const row of rows) {
        expect(Object.keys(row)).toEqual(['POST']);
      }
    }
    // The mixed rendering keeps LF inside the cell; the uniform one holds CR.
    expect(ASSISTANT_ROWS[0]!['POST']).toContain('\n');
    expect(uniform[0]!['POST']).not.toContain('\n');
    expect(uniform[0]!['POST']).toContain('\r');
  });

  test('both renderings extract the same four rows', () => {
    const uniform = parse(DEVICE_ASSISTANT_CSV_UNIFORM_CR, 'WOT_Assistant_Device_Info.csv');
    const read = (rows: Row[]) =>
      rows.flatMap((r) => {
        const f = extractAssistantFields(r['POST']);
        return f === null ? [] : [[f.deviceType, f.app, f.platform, f.version]];
      });
    expect(read(ASSISTANT_ROWS)).toEqual(DEVICE_ASSISTANT_EXPECTED_CELLS);
    expect(read(uniform)).toEqual(DEVICE_ASSISTANT_EXPECTED_CELLS);
  });
});

describe('extractAssistantFields', () => {
  test('every fixture blob yields its hand-derived fields or null', () => {
    for (const { blob, expected, note } of DEVICE_BLOBS) {
      const fields = extractAssistantFields(blob);
      if (expected === null) {
        expect(fields, note).toBeNull();
      } else {
        expect(fields, note).toEqual({
          deviceType: expected[0],
          app: expected[1],
          platform: expected[2],
          version: expected[3],
        });
      }
    }
  });

  test('reads a multi-line pretty blob, a single-line blob and a numeric Version', () => {
    expect(extractAssistantFields('{\n  "Device type": "A",\n  "App": "B"\n}')).toEqual({
      deviceType: 'A',
      app: 'B',
      platform: null,
      version: null,
    });
    expect(extractAssistantFields('{"Platform":"P","Version":12}')).toEqual({
      deviceType: null,
      app: null,
      platform: 'P',
      version: '12',
    });
  });

  test('matches keys case-insensitively and trimmed', () => {
    expect(extractAssistantFields('{" DEVICE TYPE ":"x"," app":"y"}')).toEqual({
      deviceType: 'x',
      app: 'y',
      platform: null,
      version: null,
    });
  });

  test('returns null for non-JSON-like text, an object with none of the keys, an array or a bare string', () => {
    expect(extractAssistantFields('hello world')).toBeNull();
    expect(extractAssistantFields('')).toBeNull();
    expect(extractAssistantFields(undefined)).toBeNull();
    expect(extractAssistantFields('{"Other":"x"}')).toBeNull();
    expect(extractAssistantFields('[{"Device type":"x"}]')).toBeNull();
    expect(extractAssistantFields('"Device type"')).toBeNull();
    expect(extractAssistantFields('42')).toBeNull();
  });

  test('returns null when all four values are N/D or blank', () => {
    expect(
      extractAssistantFields('{"Device type":"N/D","App":"n/d","Platform":"  ","Version":""}'),
    ).toBeNull();
  });

  test('checks the length BEFORE any parse or pattern runs', () => {
    // Valid and readable, but one character over the bound.
    const padding = ' '.repeat(MAX_BLOB_LENGTH);
    const long = `{"Device type":"x"${padding}}`;
    expect(long.length).toBeGreaterThan(MAX_BLOB_LENGTH);
    expect(extractAssistantFields(long)).toBeNull();
    // At the bound it still reads.
    const exact = `{"Device type":"x"${' '.repeat(MAX_BLOB_LENGTH - 19)}}`;
    expect(exact.length).toBe(MAX_BLOB_LENGTH);
    expect(extractAssistantFields(exact)).not.toBeNull();
  });

  test('a hostile oversized pattern-bait blob costs a length check, not a stall', () => {
    const bait = '"Device type":'.padEnd(MAX_BLOB_LENGTH * 4, ' ');
    const start = performance.now();
    expect(extractAssistantFields(bait)).toBeNull();
    expect(performance.now() - start).toBeLessThan(250);
  });

  test('reads a JSON-like blob JSON.parse rejects through the anchored patterns', () => {
    expect(
      extractAssistantFields(
        `{"Device type": "A", "App": 'B', 'Platform': "C", "Version": 1.2.3, }`,
      ),
    ).toEqual({ deviceType: 'A', app: 'B', platform: 'C', version: '1.2.3' });
    // A single-quoted key and value, trailing junk after.
    expect(extractAssistantFields("{'Device type': 'D',")).toEqual({
      deviceType: 'D',
      app: null,
      platform: null,
      version: null,
    });
  });

  test('a hostile __proto__ object with a nested object holding the keys yields null', () => {
    const hostile = '{"__proto__":{"Device type":"x","App":"y","Platform":"z","Version":"1"}}';
    expect(extractAssistantFields(hostile)).toBeNull();
    // And nothing was written onto the prototype.
    expect(({} as Record<string, unknown>)['Device type']).toBeUndefined();
  });

  test('a nested object under an allow-listed key is not a value', () => {
    expect(extractAssistantFields('{"Device type":{"a":1},"App":["x"],"Version":true}')).toBeNull();
  });

  test('the result carries exactly four fields and never the Spa id or the flags', () => {
    for (const { blob } of DEVICE_BLOBS) {
      const fields = extractAssistantFields(blob);
      if (fields === null) continue;
      expect(Object.keys(fields).sort()).toEqual(['app', 'deviceType', 'platform', 'version']);
      const text = everything(fields);
      expect(text).not.toContain(DEVICE_SPA_CANARY);
      expect(text).not.toContain(DEVICE_FLAGS_CANARY);
      expect(text).not.toContain('Spa id');
    }
  });

  test('clamps every value to the text bound', () => {
    const fields = extractAssistantFields(`{"App":"${'a'.repeat(500)}"}`);
    expect(fields?.app).toHaveLength(MAX_DEVICE_TEXT);
  });
});

describe('reduceBlobRow and hasBlobColumn', () => {
  test('reduceBlobRow keeps only the non-null stored headers', () => {
    const reduced = reduceBlobRow({ POST: DEVICE_BLOBS[0]!.blob });
    expect(reduced).toEqual({
      [ASSISTANT_STORED_HEADERS.deviceType]: 'SynthPhone',
      [ASSISTANT_STORED_HEADERS.app]: 'SynthAssistant',
      [ASSISTANT_STORED_HEADERS.platform]: 'SynthDroid',
      [ASSISTANT_STORED_HEADERS.version]: '9.9.1',
    });
    expect(everything(reduced)).not.toContain(DEVICE_SPA_CANARY);
    expect(Object.keys(reduceBlobRow({ POST: '{"App":"only"}' }))).toEqual(['APP']);
  });

  test('reduceBlobRow answers the explicit unreadable marker, and drops the overflow bucket', () => {
    expect(reduceBlobRow({ POST: 'plain text', __parsed_extra: 'spill' } as never)).toEqual({
      [DEVICE_ROW_STATE_KEY]: DEVICE_ROW_UNREADABLE,
    });
    expect(DEVICE_ROW_STATE_KEY).toBe('ROW_STATE');
    expect(DEVICE_ROW_UNREADABLE).toBe('unreadable');
  });

  test('hasBlobColumn is true for POST, a padded lower-case spelling, a fullwidth spelling and extra keys', () => {
    expect(hasBlobColumn({ POST: 'x' })).toBe(true);
    expect(hasBlobColumn({ ' post ': 'x' })).toBe(true);
    expect(hasBlobColumn({ ＰＯＳＴ: 'x' })).toBe(true);
    expect(hasBlobColumn({ OTHER: 'a', POST: 'x', __parsed_extra: 'y' } as never)).toBe(true);
  });

  test('hasBlobColumn is false for a row without the header and for POST_ID', () => {
    expect(hasBlobColumn({ OTHER: 'a' })).toBe(false);
    expect(hasBlobColumn({ POST_ID: '1' })).toBe(false);
    expect(hasBlobColumn({})).toBe(false);
  });

  test('isDeviceInfoCategory is case-insensitive', () => {
    expect(isDeviceInfoCategory('Device_info')).toBe(true);
    expect(isDeviceInfoCategory('device_info')).toBe(true);
    expect(isDeviceInfoCategory('DEVICE_INFO')).toBe(true);
    expect(isDeviceInfoCategory('Device_infos')).toBe(false);
  });
});

describe('buildDeviceInfo', () => {
  // One account, one group: the shape the reader hands over for a
  // single-account export (09-07).
  const input = {
    pc: { groups: oneAccount(PC_ROWS), seen: true },
    blitz: { groups: oneAccount(BLITZ_ROWS), seen: true },
    assistant: { groups: oneAccount(ASSISTANT_ROWS.map((r) => reduceBlobRow(r))), seen: true },
  } as const;

  /**
   * Build over the shared input with per-source overrides.
   *
   * An override may hand its rows as `rows` (a single account's flat list, which
   * is what most of these cases are about) and it is wrapped into the one group
   * the builder now takes (09-07) — so a case about N/D cells or a `__proto__`
   * header keeps stating what it states without restating the shape.
   */
  function build(overrides: Partial<Record<'pc' | 'blitz' | 'assistant', unknown>> = {}) {
    const merged = { ...input, ...overrides } as Record<string, { rows?: unknown; seen?: unknown }>;
    for (const source of Object.values(merged)) {
      if (source !== undefined && Array.isArray(source.rows)) {
        (source as { groups: unknown }).groups = oneAccount(
          source.rows as Record<string, string | undefined>[],
        );
      }
    }
    return buildDeviceInfo(merged as never);
  }

  test('the contracts name the PD-10 columns and the three lower-cased file names', () => {
    expect(PC_COLUMNS).toHaveLength(10);
    expect(BLITZ_COLUMNS).toHaveLength(8);
    expect(ASSISTANT_COLUMNS).toHaveLength(4);
    expect(DEVICE_FILE_KEYS).toEqual({
      pc: 'wot_device_info.csv',
      blitz: 'wotb_device_info.csv',
      assistant: 'wot_assistant_device_info.csv',
    });
    expect(PC_COLUMNS.map((c) => DEVICE_COLUMN_HEADERS.pc[c])).toEqual([
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
    ]);
    // The text bound is the finance one, pinned equal.
    expect(MAX_DEVICE_TEXT).toBe(MAX_STORED_STRING);
  });

  test('the fixtures give the three ready tables with the hand-derived cells', () => {
    const view = build();
    expect(view.status).toBe('ready');
    if (view.pc.status !== 'ready') throw new Error('pc not ready');
    if (view.blitz.status !== 'ready') throw new Error('blitz not ready');
    if (view.assistant.status !== 'ready') throw new Error('assistant not ready');

    expect(view.pc.columns).toEqual([...PC_COLUMNS]);
    expect(view.pc.rows).toEqual(DEVICE_PC_EXPECTED_CELLS);
    expect(view.pc.rowCount).toBe(4);
    expect(view.pc.more).toBe(0);
    expect(view.pc.unreadable).toBe(0);

    expect(view.blitz.columns).toEqual([...BLITZ_COLUMNS]);
    expect(view.blitz.rows).toEqual(DEVICE_BLITZ_EXPECTED_CELLS);
    expect(view.blitz.rowCount).toBe(3);

    expect(view.assistant.columns).toEqual([...ASSISTANT_COLUMNS]);
    expect(view.assistant.rows).toEqual(DEVICE_ASSISTANT_EXPECTED_CELLS);
    expect(view.assistant.rowCount).toBe(8);
    expect(view.assistant.unreadable).toBe(DEVICE_ASSISTANT_UNREADABLE);
  });

  test('N/D in any case and blank cells are null; memory is a number only when all digits', () => {
    const view = build({
      pc: {
        seen: true,
        rows: [
          {
            PC_TYPE: 'N/D',
            OS: 'n/d',
            OS_BIT: ' N/d ',
            CPU_VENDOR: '',
            CPU_NAME: undefined,
            CPU_CORES: '',
            GPUMEMORY: '0',
            MAINMEMORY: '1234567890',
          },
          { GPUMEMORY: '123456789', MAINMEMORY: '12 MB', CPU_CORES: '8' },
        ],
      },
    }) as DeviceInfoView;
    if (view.pc.status !== 'ready') throw new Error('pc not ready');
    const col = (id: string) => (PC_COLUMNS as readonly string[]).indexOf(id);
    const [first, second] = view.pc.rows as readonly (readonly unknown[])[];
    expect(first![col('pcType')]).toBeNull();
    expect(first![col('os')]).toBeNull();
    expect(first![col('osBit')]).toBeNull();
    expect(first![col('cpuVendor')]).toBeNull();
    expect(first![col('cpuName')]).toBeNull();
    expect(first![col('gpuMemory')]).toBe(0);
    // Ten digits is over the nine-digit bound, so it stays text.
    expect(first![col('mainMemory')]).toBe('1234567890');
    expect(second![col('gpuMemory')]).toBe(123456789);
    expect(second![col('mainMemory')]).toBe('12 MB');
    expect(second![col('cpuCores')]).toBe('8');
  });

  test('table statuses: not-in-export, no-rows and no-usable', () => {
    const notIn = build({ blitz: { groups: [], seen: false } });
    expect(notIn.blitz).toEqual({ status: 'not-in-export' });
    expect(notIn.pc.status).toBe('ready');

    const empty = build({ blitz: { groups: [], seen: true } });
    expect(empty.blitz).toEqual({ status: 'no-rows' });

    // Rows that carry none of the expected columns.
    const unusable = build({
      pc: { groups: oneAccount([{ SOMETHING: 'a' }, { SOMETHING: 'b' }]), seen: true },
    });
    expect(unusable.pc).toEqual({ status: 'no-usable', rowCount: 2, unreadable: 2 });
  });

  test('columns resolve through headerKey from the first row, whatever the case', () => {
    const view = build({
      blitz: {
        seen: true,
        rows: [{ ' model_name ': 'SynthModel', platform_name: 'SynthPlatform' }],
      },
    });
    if (view.blitz.status !== 'ready') throw new Error('blitz not ready');
    expect(view.blitz.rows[0]![(BLITZ_COLUMNS as readonly string[]).indexOf('modelName')]).toBe(
      'SynthModel',
    );
    expect(view.blitz.rows[0]![0]).toBe('SynthPlatform');
  });

  test('a __proto__ header is an ordinary key and nothing leaks', () => {
    const rows = [JSON.parse('{"__proto__":"x","PC_TYPE":"SynthBox"}') as Row];
    const view = build({ pc: { rows, seen: true } });
    if (view.pc.status !== 'ready') throw new Error('pc not ready');
    expect(view.pc.rows[0]![0]).toBe('SynthBox');
    expect(everything(view)).not.toContain('__proto__');
  });

  test('more than 200 rows list 200 and report the rest', () => {
    const rows: Row[] = Array.from({ length: MAX_DEVICE_ROWS + 37 }, (_, i) => ({
      PC_TYPE: `Synth${i}`,
    }));
    const view = build({ pc: { rows, seen: true } });
    if (view.pc.status !== 'ready') throw new Error('pc not ready');
    expect(view.pc.rows).toHaveLength(MAX_DEVICE_ROWS);
    expect(view.pc.rowCount).toBe(MAX_DEVICE_ROWS + 37);
    expect(view.pc.more).toBe(37);
  });

  test('every text value is clamped', () => {
    const view = build({ pc: { groups: oneAccount([{ PC_TYPE: 'x'.repeat(500) }]), seen: true } });
    if (view.pc.status !== 'ready') throw new Error('pc not ready');
    expect(view.pc.rows[0]![0]).toHaveLength(MAX_DEVICE_TEXT);
  });

  test('Assistant rows read the same from stored fields, the marker and a legacy raw POST cell', () => {
    const stored = [
      {
        DEVICE_TYPE: 'SynthPhone',
        APP: 'SynthAssistant',
        PLATFORM: 'SynthDroid',
        VERSION: '9.9.1',
      },
      { ROW_STATE: 'unreadable' },
    ];
    const legacy = [{ POST: DEVICE_BLOBS[0]!.blob }, { POST: 'not a blob' }];
    const a = build({ assistant: { groups: oneAccount(stored), seen: true } }).assistant;
    const b = build({ assistant: { groups: oneAccount(legacy), seen: true } }).assistant;
    expect(a).toEqual(b);
    if (a.status !== 'ready') throw new Error('assistant not ready');
    expect(a.rows).toEqual([['SynthPhone', 'SynthAssistant', 'SynthDroid', '9.9.1']]);
    expect(a.rowCount).toBe(2);
    expect(a.unreadable).toBe(1);
  });

  test('a row with only some stored fields shows the rest as not reported', () => {
    const view = build({
      assistant: { groups: oneAccount([{ APP: 'SynthAssistant' }]), seen: true },
    });
    if (view.assistant.status !== 'ready') throw new Error('assistant not ready');
    expect(view.assistant.rows).toEqual([[null, 'SynthAssistant', null, null]]);
  });

  test('an Assistant source whose rows are all unreadable is no-usable with its counts', () => {
    const rows = [{ ROW_STATE: 'unreadable' }, { POST: 'nope' }, { POST: '{"x":1}' }];
    const view = build({ assistant: { rows, seen: true } });
    expect(view.assistant).toEqual({ status: 'no-usable', rowCount: 3, unreadable: 3 });
  });

  test('a header-only Assistant file is no-rows, and an absent one not-in-export', () => {
    const headerOnly = parse(DEVICE_ASSISTANT_HEADER_ONLY_CSV, 'WOT_Assistant_Device_Info.csv');
    expect(headerOnly).toEqual([]);
    expect(build({ assistant: { groups: oneAccount(headerOnly), seen: true } }).assistant).toEqual({
      status: 'no-rows',
    });
    expect(build({ assistant: { groups: [], seen: false } }).assistant).toEqual({
      status: 'not-in-export',
    });
  });

  test('no value of the whole view holds a canary, the key POST or the text Spa id', () => {
    for (const rows of [
      ASSISTANT_ROWS.map((r) => reduceBlobRow(r)), // the fresh path
      ASSISTANT_ROWS, // the legacy path: the raw POST cells
    ]) {
      const text = everything(build({ assistant: { rows, seen: true } }));
      expect(text).not.toContain(DEVICE_SPA_CANARY);
      expect(text).not.toContain(DEVICE_FLAGS_CANARY);
      expect(text).not.toContain('POST');
      expect(text).not.toContain('Spa id');
      expect(text).not.toContain('PC configuration');
    }
  });

  test('the view is a plain structured-cloneable object of cells, never a row object', () => {
    const view = build();
    expect(structuredClone(view)).toEqual(view);
    for (const table of [view.pc, view.blitz, view.assistant]) {
      if (table.status !== 'ready') continue;
      for (const row of table.rows) expect(Array.isArray(row)).toBe(true);
    }
  });
});
