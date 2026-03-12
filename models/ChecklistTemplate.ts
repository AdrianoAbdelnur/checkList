import { Schema, model, models } from "mongoose";

const SelectOptionSchema = new Schema(
  {
    value: { type: String, required: true },
    label: { type: String, required: true },
    tone: { type: String, required: false },
    comments: [{ type: String }],
  },
  { _id: false }
);

const VisibilityRuleSchema = new Schema(
  {
    fieldId: { type: String, required: true },
    equals: { type: Schema.Types.Mixed, required: false },
    notEquals: { type: Schema.Types.Mixed, required: false },
  },
  { _id: false }
);

const FieldSchema = new Schema(
  {
    id: { type: String, required: true },
    kind: { type: String, required: true }, // triStatus|yesNo|text|number|time|date|select|radioGroup|multiSelect|note|signature
    label: { type: String, required: true },
    required: { type: Boolean, default: false },
    description: { type: String, required: false },
    placeholder: { type: String, required: false },
    multiline: { type: Boolean, required: false },
    min: { type: Number, required: false },
    max: { type: Number, required: false },
    maxSelected: { type: Number, required: false },
    showCamera: { type: Boolean, required: false },

    options: [SelectOptionSchema],
    visibleWhen: [VisibilityRuleSchema],

    requireObsWhenBad: { type: Boolean, required: false },
    requireObsWhenValues: [{ type: String }],
    badValues: [{ type: String }],
  },
  { _id: false, strict: false }
);

const SectionSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: false },
    isMain: { type: Boolean, default: false },
    displayMode: {
      type: String,
      enum: ["always", "rule"],
      default: "always",
    },
    fields: { type: [FieldSchema], default: [] },
  },
  { _id: false, strict: false }
);

const MetricSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ["triStatusSummary", "booleanSummary"],
      required: true,
    },
    fields: [{ type: String, required: true }],
    highValues: [{ type: String }],
    moderateValues: [{ type: String }],
    lowValues: [{ type: String }],
    trueValue: { type: Schema.Types.Mixed, required: false },
    falseValue: { type: Schema.Types.Mixed, required: false },
  },
  { _id: false, strict: false }
);

const RuleActionSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        "showMessage",
        "navigate",
        "showSection",
        "requireSection",
        "blockSubmit",
        "setFlag",
      ],
      required: true,
    },
    level: { type: String, required: false },
    title: { type: String, required: false },
    message: { type: String, required: false },
    targetSectionId: { type: String, required: false },
    sectionId: { type: String, required: false },
    reason: { type: String, required: false },
    key: { type: String, required: false },
    value: { type: Schema.Types.Mixed, required: false },
  },
  { _id: false, strict: false }
);

const RuleSchema = new Schema(
  {
    id: { type: String, required: true },
    trigger: {
      type: String,
      enum: ["onSectionComplete", "onBeforeSubmit", "onChecklistOpen", "onFieldChange"],
      required: true,
    },
    scope: {
      sectionId: { type: String, required: false },
      sectionIds: [{ type: String }],
    },
    when: {
      metric: { type: String, required: true },
      equals: { type: Schema.Types.Mixed, required: false },
      notEquals: { type: Schema.Types.Mixed, required: false },
      highCount: { type: Number, required: false },
      highCountMin: { type: Number, required: false },
      moderateCount: { type: Number, required: false },
      moderateCountMin: { type: Number, required: false },
      lowCount: { type: Number, required: false },
      lowCountMin: { type: Number, required: false },
      trueCount: { type: Number, required: false },
      trueCountMin: { type: Number, required: false },
      falseCount: { type: Number, required: false },
      falseCountMin: { type: Number, required: false },
      answeredCountMin: { type: Number, required: false },
    },
    actions: { type: [RuleActionSchema], default: [] },
  },
  { _id: false, strict: false }
);

const ChecklistTemplateSchema = new Schema(
  {
    id: { type: String, required: false, index: true },
    templateId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    title: { type: String, required: true },

    sections: { type: [SectionSchema], required: true, default: [] },
    metrics: { type: [MetricSchema], default: [] },
    rules: { type: [RuleSchema], default: [] },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, strict: false }
);

ChecklistTemplateSchema.index({ templateId: 1, version: 1 }, { unique: true });

export default models.ChecklistTemplate ||
  model("ChecklistTemplate", ChecklistTemplateSchema);
