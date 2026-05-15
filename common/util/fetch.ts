import type {TDataOrError} from '../types/TUtils';

export const fetch2 = async <T>(url: string, options?: RequestInit): Promise<TDataOrError<T>> => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `HTTP error! status: ${response.status}, message: ${errorText}`,
        responseCode: response.status,
      };
    }
    const data = response.status === 204 ? (null as T) : await response.json();
    return {
      ok: true,
      data,
    };
  } catch (error) {
    console.error('Fetch error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
