/**
 * The Device_info view contract, shared by the aggregation worker and the page.
 *
 * ## Why this module exists
 *
 * `device-info-aggregate.ts` builds the view inside the ingest worker and the
 * `Device info` pane reads it back on the main thread. Everything both sides
 * must agree on (the shape of a view, the file names, the column ids, the
 * bounds and the N/D token) lives here, in ONE module both can import.
 *
 * This module has **no imports at all**, and that is load-bearing, exactly as
 * it is for `finance-shared.ts`: it is what makes it legal for a worker-side
 * module and a page-side module to agree on a name without either depending on
 * the other. `grep -c '^import' src/lib/features/device-info/device-info-shared.ts`
 * printing 0 is the check that keeps it true.
 *
 * ## The three sources
 *
 * The export's `Device_info` folder holds three files, one table each:
 *
 *   - `WOT_Device_Info.csv`            PC hardware, ten columns;
 *   - `WOTB_Device_Info.csv`           Blitz devices, eight columns;
 *   - `WOT_Assistant_Device_Info.csv`  the Assistant app, ONE `POST` column
 *     whose cells are JSON-like blobs.
 *
 * ## The blob never crosses any boundary
 *
 * The Assistant blob carries the account id (the "Spa id") and an opaque flags
 * number. It is read once, at the import choke point, and reduced to the four
 * fields below (or an explicit unreadable marker). No stored row, no posted
 * view and no DOM text ever holds the blob, the `POST` key or those two values.
 */

/** The lower-cased category the three files live in. */
export const DEVICE_INFO_CATEGORY = 'device_info';

/** The three sources, in the order the pane lists them. */
export const DEVICE_SOURCES = ['pc', 'blitz', 'assistant'] as const;
export type DeviceSourceId = (typeof DEVICE_SOURCES)[number];

/**
 * The three LOWER-CASED file names. Lower-cased because the reader screens the
 * `sourceFile` index on a lower-cased name (see `readRowsByFile`).
 */
export const DEVICE_FILE_KEYS: Readonly<Record<DeviceSourceId, string>> = {
  pc: 'wot_device_info.csv',
  blitz: 'wotb_device_info.csv',
  assistant: 'wot_assistant_device_info.csv',
};

/** PC hardware columns, in file order (PD-10). */
export const PC_COLUMNS = [
  'pcType',
  'os',
  'osBit',
  'cpuVendor',
  'cpuName',
  'cpuCores',
  'gpuVendor',
  'gpuMemory',
  'mainMemory',
  'multiGpu',
] as const;
export type PcColumnId = (typeof PC_COLUMNS)[number];

/** Blitz device columns, in file order (PD-10). */
export const BLITZ_COLUMNS = [
  'platformName',
  'vendorName',
  'modelName',
  'os',
  'region',
  'shopName',
  'countryByIp',
  'countryByTz',
] as const;
export type BlitzColumnId = (typeof BLITZ_COLUMNS)[number];

/** Assistant columns: the four fields read out of the blob (PD-10). */
export const ASSISTANT_COLUMNS = ['deviceType', 'app', 'platform', 'version'] as const;
export type AssistantColumnId = (typeof ASSISTANT_COLUMNS)[number];

/** The column ids of every source, by source. */
export interface DeviceColumnIds {
  pc: PcColumnId;
  blitz: BlitzColumnId;
  assistant: AssistantColumnId;
}

/**
 * The canonical UPPER-CASE header each column id reads, for the PC and Blitz
 * files as the export writes them. The Assistant entries are the four STORED
 * headers the import writes for a reduced row.
 */
export const DEVICE_COLUMN_HEADERS: {
  readonly [S in DeviceSourceId]: Readonly<Record<DeviceColumnIds[S], string>>;
} = {
  pc: {
    pcType: 'PC_TYPE',
    os: 'OS',
    osBit: 'OS_BIT',
    cpuVendor: 'CPU_VENDOR',
    cpuName: 'CPU_NAME',
    cpuCores: 'CPU_CORES',
    gpuVendor: 'GPU_VENDOR',
    gpuMemory: 'GPUMEMORY',
    mainMemory: 'MAINMEMORY',
    multiGpu: 'MULTI_GPU',
  },
  blitz: {
    platformName: 'PLATFORM_NAME',
    vendorName: 'VENDOR_NAME',
    modelName: 'MODEL_NAME',
    os: 'OS',
    region: 'REGION',
    shopName: 'SHOP_NAME',
    countryByIp: 'COUNTRY_BY_IP',
    countryByTz: 'COUNTRY_BY_TZ',
  },
  assistant: {
    deviceType: 'DEVICE_TYPE',
    app: 'APP',
    platform: 'PLATFORM',
    version: 'VERSION',
  },
};

/** The headers a reduced Assistant row is stored under (the allow-list). */
export const ASSISTANT_STORED_HEADERS: Readonly<Record<AssistantColumnId, string>> =
  DEVICE_COLUMN_HEADERS.assistant;

/** The key of the explicit marker a row with nothing readable is stored as. */
export const DEVICE_ROW_STATE_KEY = 'ROW_STATE';

/** The marker's one value. */
export const DEVICE_ROW_UNREADABLE = 'unreadable';

/** The memory columns: a number of MB when all digits (PD-07). */
export const DEVICE_MEMORY_COLUMNS: ReadonlySet<string> = new Set(['gpuMemory', 'mainMemory']);

/** The token the export writes for a value it does not have (any case). */
export const DEVICE_NOT_AVAILABLE_TOKEN = 'N/D';

/**
 * Every text value is clamped to this many characters. Equal to
 * `MAX_STORED_STRING` in `finance-shared.ts` (pinned by a test, not imported:
 * this module has no imports).
 */
export const MAX_DEVICE_TEXT = 200;

/** At most this many rows per table cross `postMessage` (PD-09). */
export const MAX_DEVICE_ROWS = 200;

/** A blob longer than this is unreadable before any parse or pattern runs. */
export const MAX_BLOB_LENGTH = 8192;

/** A memory cell holds at most this many digits to count as a number. */
export const MAX_MEMORY_DIGITS = 9;

/** One cell: text as written, a number (memory, in MB), or null (not reported). */
export type DeviceCell = string | number | null;

/** One table row: cells in the column order of its table. */
export type DeviceRow = readonly DeviceCell[];

/**
 * One source's table.
 *
 *   - `not-in-export`: the file was never in the archive;
 *   - `no-rows`: the file was there and held no data rows;
 *   - `no-usable`: rows, but none of the expected columns resolved (PC, Blitz)
 *     or none of the Assistant rows yielded a field; carries the counts;
 *   - `ready`: `rows` are the cells to list (at most 200), `rowCount` every
 *     data row of the file, `more` the rows not listed, `unreadable` the rows
 *     from which nothing could be read.
 */
export type DeviceTableView<C extends string = string> =
  | { status: 'not-in-export' }
  | { status: 'no-rows' }
  | { status: 'no-usable'; rowCount: number; unreadable: number }
  | {
      status: 'ready';
      columns: readonly C[];
      rows: readonly DeviceRow[];
      rowCount: number;
      more: number;
      unreadable: number;
    };

/**
 * The whole answer. The top-level status is always `ready` so the shared
 * finance state functions apply unchanged; the three tables carry the real
 * states.
 */
export interface DeviceInfoView {
  status: 'ready';
  pc: DeviceTableView<PcColumnId>;
  blitz: DeviceTableView<BlitzColumnId>;
  assistant: DeviceTableView<AssistantColumnId>;
}
