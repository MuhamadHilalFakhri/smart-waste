export type Role = "admin" | "user";
export type Status = "pending" | "in_progress" | "completed" | "rejected";
export type Category = "organic" | "plastic" | "paper";
export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  active: boolean;
  created_at: Date;
}
export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  csrf_token: string;
  expires_at: Date;
  revoked: boolean;
}
export interface Report {
  id: string;
  owner_id: string;
  description: string;
  category: Category;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  image_path: string;
  status: Status;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}
export interface Prediction {
  category: Category | null;
  confidence: number | null;
  model_version: string | null;
  probabilities: Record<string, number>;
  outcome: "predicted" | "unavailable" | "failed";
}
export const publicUser = ({
  id,
  name,
  email,
  role,
  active,
  created_at,
}: User) => ({ id, name, email, role, active, created_at });
export const publicReport = ({
  image_path: _image,
  deleted_at: _deleted,
  ...report
}: Report) => report;
declare module "fastify" {
  interface FastifyRequest {
    user: User;
    session: Session;
  }
}
