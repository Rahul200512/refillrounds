import type { Facility, Medication, Resident } from '@/models';

// Display helpers shared across screens.

export function fullName(resident: Resident): string {
  return `${resident.firstName} ${resident.lastName}`;
}

export function initials(resident: Resident): string {
  return `${resident.firstName[0]}${resident.lastName[0]}`;
}

export function medLabel(med: Medication): string {
  return `${med.name} ${med.strength}`;
}

export function unitName(facility: Facility | null, unitId: string): string {
  return facility?.units.find((u) => u.id === unitId)?.name ?? 'Unknown unit';
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Case-insensitive match on resident name or room number. */
export function matchesSearch(resident: Resident, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fullName(resident).toLowerCase().includes(q) || resident.room.toLowerCase().includes(q);
}
