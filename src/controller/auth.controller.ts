import { Request, Response } from "express";
import { z } from "zod";
import { UserCreateInput, UserLoginInput } from "../types/auth.types.js";
import colors from "colors";
import { User } from "../db/Schema/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UniqueConstraintError } from "sequelize";
import { ResponseSchema } from "../types/index.js";

async function login_controller(req: Request, res: Response) {
    const body = req.body;

    const validated_body: z.infer<typeof UserLoginInput> = z.parse(
        UserLoginInput,
        body
    ) as any; // Validation

    const user = await User.findOne({
        where: {
            email: validated_body.email,
        },
    });

    if (!user) {
        return res.status(401).json({
            status: "error",
            error: "Invalid email or password",
        } as ResponseSchema);
    }

    if (!bcrypt.compareSync(validated_body.password, user.password)) {
        return res.status(401).json({
            status: "error",
            error: "Invalid email or password",
        } as ResponseSchema);
    }

    user.password = undefined;

    const jwt_token = jwt.sign(
        {
            user: user.id,
        },
            process.env.TOKEN_SECRET!,
        {
            expiresIn: "2h",
        }
    );

    return res.status(200).json({
        status: "success",
        payload: {
            user: {
                "fname": user.fname,
                "lname": user.lname,
                "email": user.email,
                "createdAt": user.createdAt,
                "updatedAt": user.updatedAt
            },
            token: jwt_token,
            message: `User ${user.email} logged in successfully`,
        },
    } as ResponseSchema);
}

async function signup_controller(req: Request, res: Response) {
    const body = req.body;

    try {
        const validated_body: z.infer<typeof UserCreateInput> = z.parse(
            UserCreateInput,
            body
        ) as any; // Validate

        const new_user = User.build(validated_body);

        await new_user.save();

        return res.status(201).json({
            status: "success",
            payload: {
                message: `User ${new_user.email} has been created`,
            },
        } as ResponseSchema);
    } catch (error) {
        if (error instanceof UniqueConstraintError) {
            return res.status(409).json({
                status: "error",
                // Formats to: ["email: Invalid email", "password: Too short"]
                error: "A user already exists with this email",
            } as ResponseSchema);
        }

        throw error;
    }
}

async function forgot_password(req: Request, res: Response) {
    
}

export { login_controller, signup_controller };
