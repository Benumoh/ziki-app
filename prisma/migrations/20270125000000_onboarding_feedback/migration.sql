-- CreateEnum
CREATE TYPE "OnboardingGoal" AS ENUM ('explore_projects', 'contribute_issues', 'work_with_agents');

-- CreateEnum
CREATE TYPE "OnboardingEventName" AS ENUM ('signup_completed', 'onboarding_started', 'onboarding_completed', 'onboarding_skipped', 'first_action', 'feedback_submitted', 'feedback_dismissed');

-- CreateTable
CREATE TABLE "UserOnboarding" (
    "userId" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "goal" "OnboardingGoal",
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "firstActionAt" TIMESTAMP(3),
    "feedbackSnoozedUntil" TIMESTAMP(3),
    "feedbackSnoozeCount" INTEGER NOT NULL DEFAULT 0,
    "feedbackClosedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOnboarding_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "OnboardingFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "goal" "OnboardingGoal",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" "OnboardingEventName" NOT NULL,
    "goal" "OnboardingGoal",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingFeedback_userId_key" ON "OnboardingFeedback"("userId");

-- CreateIndex
CREATE INDEX "OnboardingFeedback_createdAt_idx" ON "OnboardingFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "OnboardingEvent_name_createdAt_idx" ON "OnboardingEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "OnboardingEvent_userId_idx" ON "OnboardingEvent"("userId");

-- AddForeignKey
ALTER TABLE "UserOnboarding" ADD CONSTRAINT "UserOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingFeedback" ADD CONSTRAINT "OnboardingFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingEvent" ADD CONSTRAINT "OnboardingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A rating is 1 to 5 and a comment stays short, whatever writes the row.
ALTER TABLE "OnboardingFeedback" ADD CONSTRAINT "OnboardingFeedback_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "OnboardingFeedback" ADD CONSTRAINT "OnboardingFeedback_comment_check" CHECK ("comment" IS NULL OR char_length("comment") <= 1000);
ALTER TABLE "UserOnboarding" ADD CONSTRAINT "UserOnboarding_step_check" CHECK ("step" BETWEEN 0 AND 2);

-- Everyone who already has an account has finished onboarding: they never see
-- the welcome flow or the first-experience feedback prompt.
INSERT INTO "UserOnboarding" ("userId", "step", "startedAt", "completedAt", "feedbackClosedAt", "updatedAt")
SELECT "id", 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "User"
ON CONFLICT ("userId") DO NOTHING;
