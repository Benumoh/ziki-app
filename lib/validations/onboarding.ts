import { z } from "zod";
import { CHECKLIST_LINK_TASKS, FEEDBACK_COMMENT_MAX, LAST_ONBOARDING_STEP, ONBOARDING_GOALS } from "@/lib/onboarding-flow";

/** #onboarding: saving where someone is in the welcome flow. */
export const onboardingProgressSchema = z.object({
  step: z.coerce.number().int().min(0).max(LAST_ONBOARDING_STEP),
  goal: z.enum(ONBOARDING_GOALS).nullable().optional(),
});

/** #onboarding: a welcome checklist button that leads out of the page. */
export const onboardingTaskSchema = z.object({
  task: z.enum(CHECKLIST_LINK_TASKS),
  link: z.enum(["primary", "secondary"]),
});

/** #onboarding: the first-experience feedback prompt. */
export const onboardingFeedbackSchema = z.object({
  rating: z.coerce
    .number({ error: "Choose a rating from 1 to 5." })
    .int("Choose a rating from 1 to 5.")
    .min(1, "Choose a rating from 1 to 5.")
    .max(5, "Choose a rating from 1 to 5."),
  comment: z
    .string()
    .trim()
    .max(FEEDBACK_COMMENT_MAX, `Keep it under ${FEEDBACK_COMMENT_MAX} characters.`)
    .optional()
    .transform((value) => (value ? value : null)),
});
