import { CreateUserInput, UserSafe } from "../../interfaces/User.js";

export interface IAuthService {
    register: (user: CreateUserInput) => Promise<any>;
    login: (email: string, password: string) => Promise<{token: string, user: UserSafe}>;
    verifyUser: (token: string) => Promise<{isVerified: boolean, user?: UserSafe}>
}