import { where } from "sequelize";
import { CreateUserInput, UserFromDB, UserSafe } from "../../../core/interfaces/User.js";
import { User } from "../../db/Schema/User.js";
import { IUserRepository } from "./IUserRepository.js";
import { throw_custom_error } from "../../../utils/error.js";

export class userRepository implements IUserRepository {
    async create (payload: CreateUserInput): Promise<UserFromDB> {
        const user = User.build({
            fname: payload.firstname,
            lname: payload.lastname,
            password: payload.password,
            email: payload.email
        });

        await user.save();

        return user as UserFromDB;
    };

    async update(payload: UserSafe, user_id?: string, email?: string): Promise<UserFromDB> {
        // TO DO: Fix this update syntax
        // const user = User.update({
        //     where: {
        //         ...( email && { email }),
        //         ...( user_id && { user_id })
        //     }
        // }, {
            
        // })

        const user = User.build({
            fname: payload.firstname,
            lname: payload.lastname,
            password: "",
            email: payload.email
        });

        await user.save();

        return user as UserFromDB; 
    };

    async fetchByEmail(email: string){
        const user = await User.findAll({
            where: {
                email
            }
        });

        return user as unknown as UserFromDB|null
    };

    async fetchById(id: string){
        const user = await User.findByPk(id);

        return user as unknown as UserFromDB|null
    };
}