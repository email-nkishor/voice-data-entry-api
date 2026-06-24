import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getRepository } from '../db/database';
import { config } from '../config';
import { AuthUser, User, UserRole } from '../types';

export function findUserByEmail(email: string): User | undefined {
  return getRepository().findUserByEmail(email);
}

export function findUserById(id: number): User | undefined {
  return getRepository().findUserById(id);
}

export function createUser(
  email: string,
  password: string,
  name: string,
  role: UserRole
): number {
  const repo = getRepository();
  const hash = bcrypt.hashSync(password, 10);
  const id = repo.nextId('users');
  const user: User = {
    id,
    email,
    password_hash: hash,
    name,
    role,
    created_at: new Date().toISOString(),
  };
  repo.insertUser(user);
  return id;
}

export function verifyPassword(user: User, password: string): boolean {
  return bcrypt.compareSync(password, user.password_hash);
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

export function toAuthUser(user: User): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function seedDefaultUsers(): void {
  if (getRepository().countUsers() > 0) {
    return;
  }
  const users: [string, string, string, UserRole][] = [
    ['admin@institute.local', 'admin123', 'Institute Admin', 'admin'],
    ['clerk@institute.local', 'clerk123', 'Admission Clerk', 'admission_clerk'],
    ['teacher@institute.local', 'teacher123', 'Class Teacher', 'teacher'],
  ];
  for (const [email, password, name, role] of users) {
    createUser(email, password, name, role);
  }
}

export function seedDefaultGroups(): void {
  const repo = getRepository();
  if (repo.countGroups() > 0) {
    return;
  }
  const groups: [string, string, number][] = [
    ['General Admission', 'Default student group', 1],
    ['MCA Batch 2026', 'Master of Computer Applications', 0],
    ['BCA Batch 2026', 'Bachelor of Computer Applications', 0],
  ];
  for (const [name, desc, isDefault] of groups) {
    const id = repo.nextId('studentGroups');
    repo.insertGroup({
      id,
      name,
      description: desc,
      is_default: isDefault,
      client_id: null,
      created_at: new Date().toISOString(),
    });
  }
}
