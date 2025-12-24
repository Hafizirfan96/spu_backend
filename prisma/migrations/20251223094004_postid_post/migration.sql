/*
  Warnings:

  - Made the column `post_id` on table `Applicant` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `Applicant` DROP FOREIGN KEY `Applicant_post_id_fkey`;

-- AlterTable
ALTER TABLE `Applicant` MODIFY `post_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `Applicant` ADD CONSTRAINT `Applicant_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `Post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
