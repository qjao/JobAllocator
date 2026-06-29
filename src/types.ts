export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'instructor' | 'moderator';
  isApproved: boolean;
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
