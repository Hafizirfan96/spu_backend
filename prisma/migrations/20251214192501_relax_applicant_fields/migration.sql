-- DropForeignKey
ALTER TABLE `Applicant` DROP FOREIGN KEY `Applicant_district_id_fkey`;

-- DropForeignKey
ALTER TABLE `Applicant` DROP FOREIGN KEY `Applicant_post_id_fkey`;

-- AlterTable
ALTER TABLE `Applicant` MODIFY `father_name` VARCHAR(255) NULL,
    MODIFY `cell_no` VARCHAR(255) NULL,
    MODIFY `district_id` INTEGER NULL,
    MODIFY `address` VARCHAR(500) NULL,
    MODIFY `dob` DATE NULL,
    MODIFY `gender` ENUM('male', 'female') NULL,
    MODIFY `post_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Applicant` ADD CONSTRAINT `Applicant_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `Post`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Applicant` ADD CONSTRAINT `Applicant_district_id_fkey` FOREIGN KEY (`district_id`) REFERENCES `District`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
