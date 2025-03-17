import { ErrorRequestHandler, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { AppError } from "../common/utls/AppError";
import { z } from "zod";
import { clearAuthenticationCookies, REFRESH_PATH } from "../common/utls/cookies";


const formatZodError = (res: Response, error: z.ZodError) => {
    const errors = error?.issues?.map((err) => ({
        field: err.path.join("."),
        message: err.message,
    }));

    return res.status(HTTPSTATUS.BAD_REQUEST).json({ message: "Validation failed.", errors: errors });
}

export const errorHandler: ErrorRequestHandler = (
    error,
    req,
    res,
    next
): any => {
    console.error(`Error occured on PATH: ${req.path}`, error);

    if (req.path === REFRESH_PATH) {
        clearAuthenticationCookies(res);
    }

    if (error instanceof SyntaxError) {
        return res.status(HTTPSTATUS.BAD_REQUEST).json({
            message: "Invalid JSON fromat, please check your request body."
        });
    }

    if (error instanceof z.ZodError) {
        return formatZodError(res, error);
    }

    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            message: error.message,
            errorCode: error.errorCode,
        });
    }

    return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: "Internal server error",
        error: error?.message || "Unknown error occurred",
    });
};