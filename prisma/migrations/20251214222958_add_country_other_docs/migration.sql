/*
  Warnings:

  - You are about to alter the column `institution_country` on the `Qualification` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `Enum(EnumId(7))`.
  - Added the required column `country` to the `Experience` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Experience` ADD COLUMN `country` ENUM('Pakistan', 'India', 'China', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Saudi Arabia', 'United Arab Emirates', 'Other') NOT NULL,
    ADD COLUMN `country_other` VARCHAR(255) NULL,
    ADD COLUMN `document_url` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `Qualification` ADD COLUMN `document_url` VARCHAR(500) NULL,
    ADD COLUMN `institution_country_other` VARCHAR(255) NULL,
    MODIFY `institution_country` ENUM('Pakistan', 'India', 'China', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Saudi Arabia', 'United Arab Emirates', 'Other') NOT NULL;
