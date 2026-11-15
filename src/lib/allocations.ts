import { Allocation, Conflict } from '../types';

const VALID_DEPOT_DIGITS: Record<string, string> = {
  AW: '1',
  GP: '2',
  IF: '3',
  MH: '4',
  OC: '5',
  PU: '6',
  SH: '7',
};

const EXCEPTION_SUFFIXES: Record<string, string[]> = {
  GP: ['001'],
  IF: ['002'],
};

export function collapseConsecutiveHeadcodes(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const collapsed: string[] = [];
  for (const item of list) {
    const hc = String(item ?? '').trim().toUpperCase();
    if (hc && collapsed[collapsed.length - 1] !== hc) {
      collapsed.push(hc);
    }
  }
  return collapsed;
}

export function getClaimedHeadcodeSet(allocations: Allocation[], jobNumber: string): Set<string> {
  const claimed = new Set<string>();
  if (!jobNumber) return claimed;
  const normJob = jobNumber.trim().toUpperCase();
  for (const alloc of allocations) {
    if (alloc.jobNumber.trim().toUpperCase() !== normJob) continue;
    if (!alloc.isFullJob && Array.isArray(alloc.headcodes)) {
      for (const hc of alloc.headcodes) {
        const normalized = String(hc || '').trim().toUpperCase();
        if (normalized) claimed.add(normalized);
      }
    }
  }
  return claimed;
}

export function validateJobNumber(job: string, dateOrStr: Date | string): string | null {
  if (!/^[A-Za-z]{2}\d{4}$/.test(job)) {
    return 'Job number must be in format LLXXXX (e.g., AW1101).';
  }

  const upperJob = job.toUpperCase();
  const depotCode = upperJob.substring(0, 2);
  const dayCode = upperJob.charAt(2);
  const depotNum = upperJob.charAt(3);

  if (!VALID_DEPOT_DIGITS[depotCode]) {
    return `Invalid depot code. Must be one of: ${Object.keys(VALID_DEPOT_DIGITS).join(', ')}.`;
  }

  const isException = EXCEPTION_SUFFIXES[depotCode]?.includes(upperJob.substring(3));
  if (!isException && VALID_DEPOT_DIGITS[depotCode] !== depotNum) {
    return `Invalid depot number for ${depotCode}. Expected ${VALID_DEPOT_DIGITS[depotCode]}, got ${depotNum}.`;
  }

  let dateObj: Date;
  if (typeof dateOrStr === 'string') {
    const [year, month, day] = dateOrStr.split('-').map(Number);
    dateObj = new Date(year, month - 1, day);
  } else {
    dateObj = dateOrStr;
  }

  const dayOfWeek = dateObj.getDay();
  let expectedDayCodes: string[] = [];
  let dayType = '';
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    expectedDayCodes = ['1', '4'];
    dayType = 'weekday';
  } else if (dayOfWeek === 6) {
    expectedDayCodes = ['2', '5'];
    dayType = 'Saturday';
  } else if (dayOfWeek === 0) {
    expectedDayCodes = ['3', '6'];
    dayType = 'Sunday';
  }

  if (!expectedDayCodes.includes(dayCode)) {
    return `Invalid day code for a ${dayType}. Expected ${expectedDayCodes.join(' or ')}, got ${dayCode}.`;
  }

  return null;
}

export function checkAllocationConflicts(
  allocations: Allocation[],
  job: string,
  fullJob: boolean,
  headcodes: string[],
  dateStr?: string,
  excludeId?: string
): Conflict[] {
  const conflicts: Conflict[] = [];
  const upperJob = job.trim().toUpperCase();
  const normalizedHeadcodes = headcodes.map((hc) => String(hc || '').trim().toUpperCase()).filter(Boolean);

  for (const alloc of allocations) {
    if (dateStr && alloc.date !== dateStr) continue;
    if (excludeId && alloc.id === excludeId) continue;
    if (alloc.jobNumber.trim().toUpperCase() !== upperJob) continue;

    if (alloc.isFullJob) {
      conflicts.push({
        type: 'full_job',
        message: `${alloc.instructorName} has already claimed the full job ${upperJob}.`,
        conflictingAllocation: alloc,
      });
    } else if (fullJob) {
      conflicts.push({
        type: 'full_job',
        message: `${alloc.instructorName} has already claimed parts of job ${upperJob}. You cannot claim the full job.`,
        conflictingAllocation: alloc,
      });
    } else {
      const allocHeadcodes = (alloc.headcodes || []).map((hc) => String(hc || '').trim().toUpperCase());
      const overlapping = normalizedHeadcodes.filter((hc) => allocHeadcodes.includes(hc));
      if (overlapping.length > 0) {
        conflicts.push({
          type: 'headcode',
          message: `${alloc.instructorName} has already claimed headcode(s) ${overlapping.join(', ')} for job ${upperJob}.`,
          conflictingAllocation: alloc,
        });
      }
    }
  }

  return conflicts;
}

export function getRoleLabel(role?: string): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'moderator':
      return 'Moderator';
    case 'driver_manager':
      return 'Driver Manager';
    default:
      return 'Instructor';
  }
}
