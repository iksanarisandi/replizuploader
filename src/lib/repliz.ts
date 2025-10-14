const REPLIZ_API_BASE = 'https://api.repliz.com';

export interface ReplizAccount {
  _id: string;
  name: string;
  username: string;
  type: string;
  isConnected: boolean;
  picture?: string;
}

export interface ReplizAccountsResponse {
  docs: ReplizAccount[];
  totalDocs: number;
  limit: number;
  page: number;
}

export interface SchedulePayload {
  title: string;
  description: string;
  type: 'image' | 'video'; // TikTok requires "video", other platforms use "image"
  medias: {
    type: 'video';
    url: string;
    thumbnail: string;
  }[];
  scheduleAt: string; // ISO 8601
  accountId: string;
}

export interface ScheduleResponse {
  _id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  scheduleAt: string;
  accountId: string;
  [key: string]: any;
}

/**
 * Build HTTP Basic Auth header
 */
export function buildBasicAuthHeader(accessKey: string, secretKey: string): string {
  const credentials = `${accessKey}:${secretKey}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
}

/**
 * Get all connected Repliz accounts
 */
export async function getAccounts(
  accessKey: string,
  secretKey: string
): Promise<ReplizAccount[]> {
  const authHeader = buildBasicAuthHeader(accessKey, secretKey);
  
  console.log('Calling Repliz API: GET /public/account');
  const response = await fetch(
    `${REPLIZ_API_BASE}/public/account?page=1&limit=100`,
    {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    }
  );
  console.log('Repliz getAccounts response status:', response.status);

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    if (response.status === 401) {
      throw new Error('Invalid Repliz credentials (401: invalid authorization header)');
    }
    if (response.status === 402) {
      throw new Error('Invalid Repliz plan (402: invalid plan)');
    }
    const message = errorData?.message ?? response.statusText;
    throw new Error(`Failed to get accounts: ${message}`);
  }

  const data: ReplizAccountsResponse = await response.json();
  
  // Filter only connected accounts
  return data.docs.filter((account) => account.isConnected);
}

/**
 * Create a schedule post to Repliz
 */
export async function createSchedule(
  payload: SchedulePayload,
  accessKey: string,
  secretKey: string
): Promise<ScheduleResponse> {
  const authHeader = buildBasicAuthHeader(accessKey, secretKey);

  console.log('Calling Repliz API: POST /public/schedule');
  console.log('Schedule payload:', JSON.stringify(payload, null, 2));
  
  const response = await fetch(`${REPLIZ_API_BASE}/public/schedule`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  
  console.log('Repliz createSchedule response status:', response.status);

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    if (response.status === 401) {
      throw new Error('Invalid Repliz credentials');
    }
    if (response.status === 402) {
      throw new Error('Invalid Repliz plan');
    }
    const message = errorData?.message ?? response.statusText;
    throw new Error(`Failed to create schedule: ${message}`);
  }

  return await response.json();
}
