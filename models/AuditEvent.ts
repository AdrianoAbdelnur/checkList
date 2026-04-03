import { Schema, model, models } from "mongoose";

const AuditEventSchema = new Schema(
  {
    occurredAt: { type: Date, default: Date.now, index: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },

    actor: {
      userId: { type: Schema.Types.Mixed, default: null },
      email: { type: String, default: "" },
      firstName: { type: String, default: "" },
      lastName: { type: String, default: "" },
      role: { type: String, default: "" },
    },

    requestId: { type: String, default: "", index: true },
    requestMethod: { type: String, default: "" },
    requestPath: { type: String, default: "" },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },

    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  {
    strict: true,
    versionKey: false,
  }
);

AuditEventSchema.index({ entityType: 1, entityId: 1, occurredAt: -1 });

export default models.AuditEvent || model("AuditEvent", AuditEventSchema);
