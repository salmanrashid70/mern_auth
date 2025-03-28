import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config/app.config";
import connectionDatabase from "./database/database";
import { errorHandler } from "./middlewares/errorHandler";
import { HTTPSTATUS } from "./config/http.config";
import { asyncHandler } from "./middlewares/asyncHandler";
import authRoutes from "./modules/auth/auth.routes";
import passport from "passport";
import { setupJwtStrategry } from "./common/strategies/jwt.strategy";

const app = express();
const BASE_PATH = config.BASE_PATH;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    cors({
        origin: config.APP_ORIGIN,
        credentials: true,
    })
);

app.use(cookieParser());

app.get('/', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    res.status(HTTPSTATUS.OK).json({ messsage: "Backend is ready to serve the service." });
}));

app.use(passport.initialize());
setupJwtStrategry(passport);

app.use(`${BASE_PATH}/auth`, authRoutes);

app.use(errorHandler);

app.listen(config.PORT, async () => {
    console.log(`Server listening on port ${config.PORT} in ${config.NODE_ENV}`);
    await connectionDatabase()
});