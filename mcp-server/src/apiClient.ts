const BASE_URL = process.env.BABY_API_URL ?? 'http://localhost:3000';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ApiResponse = {
  status: number;
  data: unknown;
};

export const apiCall = async (
  method: HttpMethod,
  path: string,
  body?: unknown
): Promise<ApiResponse> => {
  const url = `${BASE_URL}${path}`;

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (response.status === 204) {
    return { status: 204, data: { success: true } };
  }

  const data: unknown = await response.json();
  return { status: response.status, data };
};

