import { UserFromDB, UserSafe } from "../core/interfaces/User.js";

export class CleaningUtils {
    static convertToSafeUser(user: UserFromDB): UserSafe {
        return {
            firstname: user.firstname,
            lastname: user.lastname
        }
    } 
}