/** Per-site colors for the Compare Sites charts. The primary site always
 *  reads as the same sage used elsewhere in the app (Total Run by Year's
 *  bars, the selected-site map pin); comparison sites cycle through a small
 *  fixed palette chosen to stay distinguishable from sage and from each
 *  other, and to hold up against the stone-50/100 chart backgrounds. */
export const PRIMARY_COLOR = '#59784a'

const COMPARE_PALETTE = ['#2a78d6', '#c2410c', '#9333ea', '#0d9488', '#be123c', '#a16207']

export function colorForCompareIndex(index: number): string {
  return COMPARE_PALETTE[index % COMPARE_PALETTE.length]
}
