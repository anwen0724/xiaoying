CREATE DATABASE IF NOT EXISTS xiaoying
    CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE xiaoying;

CREATE TABLE users (
    id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    created_at DATETIME(3) NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE templates (
    id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    category VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    category_name VARCHAR(64) NOT NULL,
    cover_path VARCHAR(512) NOT NULL,
    required_image_count SMALLINT UNSIGNED NOT NULL,
    accepted_mime_types JSON NOT NULL,
    max_file_size_bytes BIGINT UNSIGNED NOT NULL,
    result_preset_path VARCHAR(512) NOT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_templates_category_sort (category, sort_order, id),
    CONSTRAINT chk_templates_count CHECK (required_image_count > 0),
    CONSTRAINT chk_templates_size CHECK (max_file_size_bytes > 0),
    CONSTRAINT chk_templates_mime_array CHECK (
        JSON_TYPE(accepted_mime_types) = 'ARRAY'
        AND JSON_LENGTH(accepted_mime_types) > 0
    )
) ENGINE=InnoDB;

CREATE TABLE assets (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    mime_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    size_bytes BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_assets_storage (storage_path),
    KEY idx_assets_user (user_id),
    CONSTRAINT fk_assets_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_assets_size CHECK (size_bytes > 0),
    CONSTRAINT chk_assets_mime CHECK (mime_type IN ('image/jpeg', 'image/png'))
) ENGINE=InnoDB;

CREATE TABLE tasks (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    template_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    template_title VARCHAR(120) NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'QUEUED',
    stage VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL DEFAULT NULL,
    version BIGINT UNSIGNED NOT NULL DEFAULT 0,
    failure_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL DEFAULT NULL,
    failure_reason VARCHAR(500) NULL DEFAULT NULL,
    result_path VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL DEFAULT NULL,
    created_at DATETIME(3) NOT NULL,
    started_at DATETIME(3) NULL DEFAULT NULL,
    finished_at DATETIME(3) NULL DEFAULT NULL,
    simulation_config JSON NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tasks_result (result_path),
    KEY idx_tasks_user_created (user_id, created_at DESC, id DESC),
    KEY idx_tasks_user_template_created (user_id, template_id, created_at DESC, id DESC),
    KEY idx_tasks_user_status (user_id, status),
    KEY idx_tasks_template (template_id),
    CONSTRAINT fk_tasks_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_tasks_template FOREIGN KEY (template_id)
        REFERENCES templates (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_tasks_status CHECK (
        status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED')
    ),
    CONSTRAINT chk_tasks_stage CHECK (
        stage IS NULL OR stage IN ('MATERIAL_CHECK', 'MOCK_GENERATION', 'RESULT_FINALIZATION')
    ),
    CONSTRAINT chk_tasks_simulation CHECK (JSON_TYPE(simulation_config) = 'OBJECT'),
    CONSTRAINT chk_tasks_state_fields CHECK (
        (status = 'QUEUED' AND stage IS NULL AND started_at IS NULL
            AND finished_at IS NULL AND result_path IS NULL
            AND failure_code IS NULL AND failure_reason IS NULL)
        OR
        (status = 'RUNNING' AND stage IS NOT NULL AND started_at IS NOT NULL
            AND finished_at IS NULL AND result_path IS NULL
            AND failure_code IS NULL AND failure_reason IS NULL)
        OR
        (status = 'SUCCEEDED' AND stage IS NOT NULL AND stage = 'RESULT_FINALIZATION'
            AND started_at IS NOT NULL AND finished_at IS NOT NULL
            AND result_path IS NOT NULL AND failure_code IS NULL AND failure_reason IS NULL)
        OR
        (status = 'FAILED' AND finished_at IS NOT NULL AND result_path IS NULL
            AND failure_code IS NOT NULL AND failure_reason IS NOT NULL
            AND ((stage IS NULL AND started_at IS NULL)
                OR (stage IS NOT NULL AND started_at IS NOT NULL)))
    )
) ENGINE=InnoDB;

CREATE TABLE task_inputs (
    task_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    position SMALLINT UNSIGNED NOT NULL,
    asset_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (task_id, position),
    UNIQUE KEY uq_task_inputs_asset (task_id, asset_id),
    KEY idx_task_inputs_asset (asset_id),
    CONSTRAINT fk_task_inputs_task FOREIGN KEY (task_id)
        REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_task_inputs_asset FOREIGN KEY (asset_id)
        REFERENCES assets (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_task_inputs_position CHECK (position > 0)
) ENGINE=InnoDB;

CREATE TABLE task_steps (
    task_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    stage VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    position TINYINT UNSIGNED NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'PENDING',
    started_at DATETIME(3) NULL DEFAULT NULL,
    finished_at DATETIME(3) NULL DEFAULT NULL,
    failure_reason VARCHAR(500) NULL DEFAULT NULL,
    PRIMARY KEY (task_id, stage),
    UNIQUE KEY uq_task_steps_position (task_id, position),
    CONSTRAINT fk_task_steps_task FOREIGN KEY (task_id)
        REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_task_steps_order CHECK (
        (position = 1 AND stage = 'MATERIAL_CHECK')
        OR (position = 2 AND stage = 'MOCK_GENERATION')
        OR (position = 3 AND stage = 'RESULT_FINALIZATION')
    ),
    CONSTRAINT chk_task_steps_status CHECK (
        status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED')
    ),
    CONSTRAINT chk_task_steps_state_fields CHECK (
        (status = 'PENDING' AND started_at IS NULL AND finished_at IS NULL AND failure_reason IS NULL)
        OR (status = 'RUNNING' AND started_at IS NOT NULL AND finished_at IS NULL AND failure_reason IS NULL)
        OR (status = 'SUCCEEDED' AND started_at IS NOT NULL AND finished_at IS NOT NULL AND failure_reason IS NULL)
        OR (status = 'FAILED' AND started_at IS NOT NULL AND finished_at IS NOT NULL AND failure_reason IS NOT NULL)
        OR (status = 'SKIPPED' AND started_at IS NULL AND finished_at IS NOT NULL AND failure_reason IS NULL)
    )
) ENGINE=InnoDB;
