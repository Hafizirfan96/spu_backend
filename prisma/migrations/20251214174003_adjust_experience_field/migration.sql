-- CreateTable
CREATE TABLE `Qualification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicant_id` INTEGER NOT NULL,
    `degree_type` ENUM('matric', 'intermediate', 'bachelor', 'master', 'mphil', 'phd', 'diploma', 'certification', 'other') NOT NULL,
    `field_of_study` ENUM('public administration', 'business administration', 'economics', 'accounting and finance', 'law', 'management', 'human resources', 'information technology', 'computer science', 'data science', 'statistics', 'engineering', 'social sciences', 'public policy', 'international relations', 'other') NOT NULL,
    `field_of_study_other` VARCHAR(255) NULL,
    `institution_name` VARCHAR(255) NOT NULL,
    `institution_country` VARCHAR(255) NOT NULL,
    `graduation_year` INTEGER NOT NULL,
    `grade` VARCHAR(255) NOT NULL,
    `duration_months` INTEGER NOT NULL,
    `is_foreign` BOOLEAN NOT NULL,
    `notes` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Experience` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicant_id` INTEGER NOT NULL,
    `organization_name` VARCHAR(255) NOT NULL,
    `organization_type` ENUM('government', 'semi-government', 'private', 'international', 'ngo', 'other') NOT NULL,
    `department` VARCHAR(255) NOT NULL,
    `designation` VARCHAR(255) NOT NULL,
    `grade` VARCHAR(255) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `is_current` BOOLEAN NOT NULL,
    `duties_summary` TEXT NULL,
    `achievements` TEXT NULL,
    `district_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Qualification` ADD CONSTRAINT `Qualification_applicant_id_fkey` FOREIGN KEY (`applicant_id`) REFERENCES `Applicant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Experience` ADD CONSTRAINT `Experience_applicant_id_fkey` FOREIGN KEY (`applicant_id`) REFERENCES `Applicant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Experience` ADD CONSTRAINT `Experience_district_id_fkey` FOREIGN KEY (`district_id`) REFERENCES `District`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
