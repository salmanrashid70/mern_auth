import jwt, { SignOptions, VerifyOptions } from "jsonwebtoken";
import { config } from "../../config/app.config";
import mongoose from "mongoose";

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

const defaults: SignOptions = {
    audience: ["user"],
};

export const accessTokenSignOptions: SignOptsAndSecret = {
    expiresIn: config.JWT.EXPIRES_IN,
    secret: config.JWT.SECRET,
};

export const refreshTokenSignOptions: SignOptsAndSecret = {
    expiresIn: config.JWT.REFRESH_EXPIRES_IN,
    secret: config.JWT.REFRESH_SECRET,
};

export const signJwtToken = (payload: AccessTokenPayload | RefreshTokenPayload, options?: SignOptsAndSecret) => {
    const { secret, ...opts } = options || accessTokenSignOptions;

    return jwt.sign(
        payload,
        secret,
        { ...defaults, ...opts } as SignOptions
    );
}

export const verifyJwtToken = <TokenPayload extends object = AccessTokenPayload>(
    token: string,
    options?: VerifyOptions & { secret: string }
) => {
    try {
        const { secret = config.JWT.SECRET, ...opts } = options || {};

        const payload = jwt.verify(token, secret, { ...defaults, ...opts }) as TokenPayload;

        return { payload };

    } catch (err: any) {
        return {
            error: err.message
        };
    }
};