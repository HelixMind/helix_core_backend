import { CreateUserInput, UserFromDB, UserSafe } from "../../../core/interfaces/User.js";

export interface IUserRepository {
    create: (payload: CreateUserInput) => Promise<UserFromDB|null>;
    update: (payload: UserSafe, user_id?: string, email?: string) => Promise<UserFromDB|null>;
    fetchByEmail: (email: string) => Promise<UserFromDB|null>;
    fetchById: (email: string) => Promise<UserFromDB|null>;
}