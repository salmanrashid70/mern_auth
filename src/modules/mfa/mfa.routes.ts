import { Router } from "express";
import { authenticateJWT } from "../../common/strategies/jwt.strategy";
import { mfaController } from "./mfa.modul";

const mfaRoutes = Router();

mfaRoutes.get('/', authenticateJWT, mfaController.generateMFASetup);
mfaRoutes.post("/verify", authenticateJWT, mfaController.verifyMFASetup);
mfaRoutes.put("/revoke", authenticateJWT, mfaController.revokeMFA);

mfaRoutes.post("/verify-login", mfaController.verifyMFAForLogin);

export default mfaRoutes;