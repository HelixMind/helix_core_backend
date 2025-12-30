import { Response } from "express";
import { ZodError } from "zod";
import { ResponseSchema } from "../types/index.js";

function handle_error(error: any, res: Response) {
  if (error instanceof ZodError) {
    const error_message: string[] = [];

    const keys = Object.keys(error.format());

    Object.values(error.format()).forEach((error, i) => {
      if (!Array.isArray(error) && error["_errors"]) {
        error_message.push((error["_errors"] as string[]).join(", "));
      }
    });

    return res.status(400).json({
      status: "error",
      // Formats to: ["email: Invalid email", "password: Too short"]
      error: error_message.join(", "),
    } as ResponseSchema);
  }

  res.status(500).json({
    status: "error",
    error: error instanceof Error ? error.message : error,
  } as ResponseSchema);
}

function throw_custom_error(message: string, code: number, res: Response) {
  if (code == 200 || code == 201) throw new Error("Something went wrong");

  return res.status(code).json({
    status: "error",
    error: message
  } as ResponseSchema);
}

export { handle_error, throw_custom_error };
