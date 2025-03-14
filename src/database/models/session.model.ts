import mongoose, { Schema } from "mongoose";
import { thirtyDaysFromNow } from "../../common/utls/date-time";


export interface SessionDocument extends Document {
    userId: mongoose.Types.ObjectId;
    userAgent?: string;
    expiredAt: Date;
    createdAt: Date;
}

const sessionSchema = new Schema<SessionDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
        userAgent: { type: String, required: false },
        createdAt: { type: Date, default: Date.now },
        expiredAt: { type: Date, default: thirtyDaysFromNow }
    },
    {
        timestamps: true,
        toJSON: {}
    }
);

sessionSchema.set("toJSON", {
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;

        return ret;
    }
})

const SessionModel = mongoose.model<SessionDocument>("Session", sessionSchema);

export default SessionModel;