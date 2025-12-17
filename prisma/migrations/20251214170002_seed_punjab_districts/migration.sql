/*
  Warnings:

  - Added the required column `dob` to the `Applicant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `Applicant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Applicant` ADD COLUMN `dob` DATE NOT NULL,
    ADD COLUMN `gender` ENUM('male', 'female') NOT NULL,
    ADD COLUMN `url_academic_certificates` VARCHAR(500) NULL,
    ADD COLUMN `url_cnic` VARCHAR(500) NULL,
    ADD COLUMN `url_cv` VARCHAR(500) NULL,
    ADD COLUMN `url_experience_certificates` VARCHAR(500) NULL,
    ADD COLUMN `url_profile_pic` VARCHAR(500) NULL;
