import { Request, Response } from "express";
import {z, ZodError} from "zod";
import { UserCreateInput, UserLoginInput } from "../types/auth.types.js";
import colors from "colors";
import { User } from "../db/Schema/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UniqueConstraintError } from "sequelize";

async function login_controller(req: Request, res: Response) {
    const body = req.body;

    try {
        const validated_body: z.infer<typeof UserLoginInput> = z.parse(UserLoginInput, body) as any; // Validation

        const user = await User.findOne({
            where: {
                email: validated_body.email
            }
        });

        if (!user) {
            return res.status(401).json({
                status: "error",
                error: "Invalid email or password"
            });
        }

        if (!bcrypt.compareSync(validated_body.password, user.password)) {
            return res.status(401).json({
                status: "error",
                error: "Invalid email or password"
            });
        }

        user.password = undefined;

        const jwt_token = jwt.sign(
            {
                user: user.id
            }, 
            process.env.TOKEN_SECRET!,
            {
                expiresIn: "2h"
            }
        );

        return res.status(200).json({
            status: "success",
            payload: {
                user,
                token: jwt_token,
                message: `User ${user.email} logged in successfully`
            }
        })
    }  catch (error) {
        if (error instanceof ZodError) {
            const error_message: Record<string, any> = {};

            const keys = Object.keys(error.format());

            Object.values(error.format()).forEach((error, i) => {
                if (!Array.isArray(error) && error["_errors"]) {
                    error_message[keys[i]] = (error["_errors"] as string[]).join(", ");
                }
            })

            return res.status(400).json({
                status: "error",
                // Formats to: ["email: Invalid email", "password: Too short"]
                error: error_message
            });
        }

        res.status(500).json({
            status: "error",
            error: error instanceof Error ? error.message : error
        })
    }
}

async function signup_controller(req: Request, res: Response) {
    const body = req.body;

    try {
        const validated_body: z.infer<typeof UserCreateInput> = z.parse(UserCreateInput, body) as any; // Validate

        const new_user = User.build(validated_body);

        await new_user.save();

        return res.status(201).json({
            status: "success",
            payload: {
                message: `User ${new_user.email} has been created`
            }
        })
    } catch (error) {
        if (error instanceof ZodError) {
            const error_message: Record<string, any> = {};

            const keys = Object.keys(error.format());

            Object.values(error.format()).forEach((error, i) => {
                if (!Array.isArray(error) && error["_errors"]) {
                    error_message[keys[i]] = (error["_errors"] as string[]).join(", ");
                }
            })

            return res.status(400).json({
                status: "error",
                // Formats to: ["email: Invalid email", "password: Too short"]
                error: error_message
            });
        }

        if (error instanceof UniqueConstraintError) {
            return res.status(409).json({
                status: "error",
                // Formats to: ["email: Invalid email", "password: Too short"]
                error: "A user already exists with this email"
            });
        }

        res.status(500).json({
            status: "error",
            error: error instanceof Error ? error.message : error
        })
    }
}

export {
    login_controller,
    signup_controller
}
