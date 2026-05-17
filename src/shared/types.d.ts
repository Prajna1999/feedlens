/**
 * @typedef {'ad' | 'subscribed' | 'recommended' | 'unknown'} CardClass
 */

/**
 * @typedef {{ ts: number, class: CardClass, fp: string }} CardEvent
 */

/**
 * @typedef {{ ad: number, subscribed: number, recommended: number, unknown: number }} Totals
 */

/**
 * @typedef {{ schemaVersion: number, events: CardEvent[], totals: Totals }} StorageData
 */
