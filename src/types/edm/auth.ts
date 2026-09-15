export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user?: {
    id: number;
    email: string;
    name: string;
  };
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
