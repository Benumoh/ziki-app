-- #site-glance: the last quick look at a project's site, and when it was taken.
ALTER TABLE "Project" ADD COLUMN "siteCheck" JSONB;
ALTER TABLE "Project" ADD COLUMN "siteCheckedAt" TIMESTAMP(3);
