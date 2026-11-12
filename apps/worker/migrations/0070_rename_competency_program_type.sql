-- Custom SQL migration file, put your code below! --
UPDATE `programs` SET `program_type` = '역량 활용' WHERE `program_type` = '역량 활동';