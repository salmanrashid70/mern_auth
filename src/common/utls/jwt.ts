import jwt, { SignOptions } from "jsonwebtoken";
import mongoose from "mongoose";
import { config } from "../../config/app.config";

export type AccessTokenPayload = {
    userId: mongoose.Types.ObjectId;
    sessionId: mongoose.Types.ObjectId;
}

export type RefreshTokenPayload = {
    sessionId: mongoose.Types.ObjectId;
}

type SignOptsAndSecret = {
    expiresIn: string;
    secret: string;
};

export const accessTokenSignOptions: SignOptsAndSecret = {
    expiresIn: config.JWT.EXPIRES_IN,
    secret: config.JWT.SECRET,
};

export const signJwtToken = (payload: AccessTokenPayload | RefreshTokenPayload) => {
    const { secret, expiresIn } = accessTokenSignOptions;

    return jwt.sign(
        payload,
        secret,
        { audience: "user", expiresIn } as SignOptions
    );
}