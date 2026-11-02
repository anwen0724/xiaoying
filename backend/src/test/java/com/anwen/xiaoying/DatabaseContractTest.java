package com.anwen.xiaoying;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
class DatabaseContractTest {
    @Autowired JdbcTemplate database;

    @Test
    void mysqlRejectsOrphanInputsDuplicatePositionsAndInvalidState() {
        String task = UUID.randomUUID().toString();
        String asset = UUID.randomUUID().toString();
        database.update("""
            INSERT INTO tasks(id,user_id,template_id,template_title,created_at,simulation_config)
            VALUES(?,'demo-alice','mountain-card','fixture','2026-11-02 00:00:00.123',
                '{"stepDelayMs":0,"failAtStage":null}')
            """, task);
        database.update("""
            INSERT INTO assets(id,user_id,original_name,storage_path,mime_type,size_bytes,created_at)
            VALUES(?,'demo-alice','fixture.png',?,'image/png',1,UTC_TIMESTAMP(3))
            """, asset, "fixtures/" + asset);
        assertThatThrownBy(() -> database.update(
            "INSERT INTO task_inputs(task_id,position,asset_id) VALUES(?,1,?)", task, UUID.randomUUID().toString()))
            .isInstanceOf(DataIntegrityViolationException.class);
        database.update("INSERT INTO task_inputs(task_id,position,asset_id) VALUES(?,1,?)", task, asset);
        assertThatThrownBy(() -> database.update(
            "INSERT INTO task_inputs(task_id,position,asset_id) VALUES(?,2,?)", task, asset))
            .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> database.update("UPDATE tasks SET status='SUCCEEDED' WHERE id=?", task))
            .rootCause().isInstanceOfSatisfying(java.sql.SQLException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(3819));
        database.update("INSERT INTO task_steps(task_id,stage,position) VALUES(?,'MATERIAL_CHECK',1)", task);
        assertThatThrownBy(() -> database.update(
            "INSERT INTO task_steps(task_id,stage,position) VALUES(?,'MOCK_GENERATION',1)", task))
            .rootCause().isInstanceOfSatisfying(java.sql.SQLException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(3819));
        assertThat(database.queryForObject(
            "SELECT DATE_FORMAT(created_at, '%f') FROM tasks WHERE id=?", String.class, task)).isEqualTo("123000");
        assertThat(database.queryForObject(
            "SELECT JSON_EXTRACT(simulation_config, '$.stepDelayMs') FROM tasks WHERE id=?", Integer.class, task)).isZero();
    }
}
