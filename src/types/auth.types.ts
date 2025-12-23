import { z } from "zod";

const UserCreateInput = z.object({
    fname: z.string().min(2).max(100),
    lname: z.string().min(2).max(100),
    email: z.email().max(255),
    password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/, "Password too weak, one digit, one special character, one uppercase and one lowercase character needed")
})

const UserLoginInput = z.object({
    email: z.email().max(255),
    password: z.string()
})

export {
    UserCreateInput,
    UserLoginInput
}