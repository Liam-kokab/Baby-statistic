type ApiResponse = {
  status: number;
  data: unknown;
};

export const jsonResponse = (res: ApiResponse) => {
  const isError = res.status >= 400;
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(res.data, null, 2),
      },
    ],
    isError,
  };
};

const OSLO_TZ = 'Europe/Oslo';

const getOsloParts = (date: Date): Record<string, string> => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: OSLO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
};

export const formatOsloLocal = (date: Date): string => {
  const parts = getOsloParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
};

