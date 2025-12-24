/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `Applicant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Applicant_username_key` ON `Applicant`(`username`);
