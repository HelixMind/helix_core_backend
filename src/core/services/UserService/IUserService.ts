import { CreateUserInput,UserFromDB,UserSafe } from "../../interfaces/User.js";

export interface IUserService {
    createUser: (payload: CreateUserInput)  => Promise<UserFromDB|null>;
    updateProfile: (user_id: string, payload: UserSafe) => Promise<UserFromDB|null>;
    getByEmail: (email: string) => Promise<UserFromDB|null>;
    getById: (id: string) => Promise<UserFromDB|null>;
}