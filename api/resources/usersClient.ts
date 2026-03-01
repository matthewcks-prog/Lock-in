import type { ApiRequest } from '../fetcher';

export type UsersClient = {
  deleteMyAccount: () => Promise<void>;
};

async function deleteMyAccountRequest(apiRequest: ApiRequest): Promise<void> {
  return apiRequest<void>('/api/users/me', {
    method: 'DELETE',
  });
}

export function createUsersClient(apiRequest: ApiRequest): UsersClient {
  return {
    deleteMyAccount: async () => deleteMyAccountRequest(apiRequest),
  };
}
