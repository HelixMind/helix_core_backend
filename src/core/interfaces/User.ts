export interface UserSafe {
    firstname: string,
    lastname: string,
    email: string
};

export type UserFromDB = {
    id: string,
    password: string 
} & UserSafe;

export type CreateUserInput = {
   password: string 
} & UserSafe;
