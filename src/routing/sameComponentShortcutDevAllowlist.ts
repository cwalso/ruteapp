/**
 * Development-only allowlist for the controlled same-component shortcut
 * routing experiment. The full deterministic candidate IDs are authoritative;
 * the shorter SC-XXXXXXXX labels are only display identifiers.
 */
export const sameComponentShortcutDevAllowlist = [
  'same-component-shortcut:1446990760:1:f:1.000000:896319498:8:f:1.000000',
  'same-component-shortcut:313417840:16:f:0.479781:313455450:13:f:0.000000',
  'same-component-shortcut:313417840:15:f:1.000000:313455450:14:f:0.000000',
  'same-component-shortcut:1467835568:1:f:1.000000:739632975:2:f:0.474119',
] as const

const allowedCandidateIds = new Set<string>(
  sameComponentShortcutDevAllowlist,
)

export function isSameComponentShortcutDevAllowed(candidateId: string) {
  return allowedCandidateIds.has(candidateId)
}
