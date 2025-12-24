/*
  Warnings:

  - A unique constraint covering the columns `[cnic,post_id]` on the table `Applicant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Applicant_cnic_post_id_key` ON `Applicant`(`cnic`, `post_id`);
