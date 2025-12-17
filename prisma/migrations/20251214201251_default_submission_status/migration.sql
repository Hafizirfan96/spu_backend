-- AlterTable
ALTER TABLE `Applicant` MODIFY `submission_status` ENUM('not submitted', 'submitted') NOT NULL DEFAULT 'not submitted';
