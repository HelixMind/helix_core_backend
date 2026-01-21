import { IUserRepository } from "../../../infrastructure/repositories/UserRepository/IUserRepository.js";
import { CreateUserInput, UserFromDB, UserSafe } from "../../interfaces/User.js";
import { type IUserService } from "./IUserService.js";

const mockUser: UserFromDB = {
    firstname: "",
    password: "",
    lastname: "",
    id: "",
    email: ""
}

export class UserService implements IUserService {
    private userRepository: IUserRepository|null = null;

    constructor (userRepository: IUserRepository) {
        this.userRepository = userRepository
    }

    checkServiceRegistered(): never | void {
        if (!this.userRepository) throw new Error("No user service registered"); // Use custom errors
    }

    async createUser(payload: CreateUserInput) {
        this.checkServiceRegistered();

        return this.userRepository?.create(payload)!;
    }

    async updateProfile(user_id: string, newUserData: UserSafe) {
        this.checkServiceRegistered();

        return this.userRepository?.update(newUserData, user_id)!;
    }

    async getByEmail(email: string) {
        return mockUser
    }

    async getById(id: string) {
        return mockUser
    }
}