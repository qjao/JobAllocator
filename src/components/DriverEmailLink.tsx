import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';

interface DriverEmailLinkProps {
  jobNumber: string;
  date: string;
  isFullJob: boolean;
  headcodes: string[];
  notes?: string;
  currentUserName: string;
  isDemo?: boolean;
  driverName?: string;
  className?: string;
}

export default function DriverEmailLink({
  jobNumber,
  date,
  isFullJob,
  headcodes,
  notes = '',
  currentUserName,
  isDemo,
  driverName,
  className = 'inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline'
}: DriverEmailLinkProps) {
  const [resolvedDriverName, setResolvedDriverName] = useState(driverName || '');

  useEffect(() => {
    setResolvedDriverName(driverName || '');
    if (driverName) return;

    let cancelled = false;
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ date, job: jobNumber });
    fetch(`/api/diagrams/driver-info?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!cancelled && data?.found && data.driverName) setResolvedDriverName(data.driverName);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [driverName, isDemo, date, jobNumber]);

  if (!resolvedDriverName) return null;

  const nameParts = resolvedDriverName.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length < 2) return null;

  const normalizeNamePart = (part: string) => part
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(isDemo ? /[^a-zA-Z0-9*-]/g : /[^a-zA-Z0-9-]/g, '')
    .toLowerCase();
  const emailDomain = isDemo ? 'g***.co.uk' : 'gtsr.co.uk';
  const email = `${normalizeNamePart(nameParts[0])}.${normalizeNamePart(nameParts[nameParts.length - 1])}@${emailDomain}`;
  const [year, month, day] = date.slice(0, 10).split('-');
  const formattedDate = year && month && day ? `${day}/${month}/${year}` : date;
  const allocationDetails = isFullJob || headcodes.length === 0
    ? `Would you be happy for me to use the full ${jobNumber} diagram on ${formattedDate} for driver instruction?`
    : `Would you be happy for me to use ${jobNumber} on ${formattedDate} for driver instruction, covering headcodes ${headcodes.join(', ')}?`;
  const trimmedNotes = notes.trim();
  const body = `Hi ${nameParts[0]},\n\n${allocationDetails}${trimmedNotes ? `\n\nFor context: ${trimmedNotes}` : ''}\n\nPlease let me know if that would be a problem.\n\nMany thanks,\n${currentUserName}`;
  const subject = `${jobNumber} - ${formattedDate} - DI Cut out`;
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <a href={mailto} className={className}>
      <Mail className="w-4 h-4" />
      {isDemo ? `Email driver (${email})` : 'Email driver (Confirm email address)'}
    </a>
  );
}
