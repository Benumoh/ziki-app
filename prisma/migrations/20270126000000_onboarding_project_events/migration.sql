-- #onboarding: two more funnel steps, inside a newcomer's first project
-- (#getting-started): the site's address saved, and their first idea posted.
-- Only the new values here: nothing in this migration uses them.
ALTER TYPE "OnboardingEventName" ADD VALUE 'website_saved';
ALTER TYPE "OnboardingEventName" ADD VALUE 'first_idea_posted';
