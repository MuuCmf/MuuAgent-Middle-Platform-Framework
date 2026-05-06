-- ===========================================
-- MySQL 初始化脚本
-- 创建数据库和用户
-- ===========================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS muu_ai_platform 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- 创建专用用户（如果不存在）
CREATE USER IF NOT EXISTS 'muu_ai'@'%' IDENTIFIED BY 'MuAI_2026_Prod_Pass';

-- 授予权限
GRANT ALL PRIVILEGES ON muu_ai_platform.* TO 'muu_ai'@'%';

-- 刷新权限
FLUSH PRIVILEGES;

-- 使用数据库
USE muu_ai_platform;

-- 设置时区
SET GLOBAL time_zone = '+8:00';
SET time_zone = '+8:00';
