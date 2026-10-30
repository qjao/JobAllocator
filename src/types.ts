export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'instructor' | 'moderator' | 'driver_manager';
  isApproved: boolean;
  isDummy?: boolean;
  approval_email_sent?: boolean;
  lastLoginAt?: string | null;
  lastAllocationAt?: string | null;
  last_login_at?: string | null;
  last_allocation_at?: string | null;
  apiStats?: {
    hour: number;
    day: number;
    month: number;
  };
}

export interface Allocation {
  id: string;
  date: string; // YYYY-MM-DD
  instructorId: string;
  instructorName: string;
  jobNumber: string; // LLXXXX
  isFullJob: boolean;
  headcodes: string[]; // XLXX
  notes?: string;
  createdAt: number; // Unix timestamp
  updatedAt?: number; // Unix timestamp
}

export interface Conflict {
  type: 'full_job' | 'headcode';
  message: string;
  conflictingAllocation: Allocation;
}
